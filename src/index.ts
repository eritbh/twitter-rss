import dotenv from 'dotenv';
dotenv.config();

import {TwitterApiReadOnly} from 'twitter-api-v2';
import express from 'express';

import {xmlEscape} from './util';

const client = new TwitterApiReadOnly(process.env.TWITTER_BEARER_TOKEN!);

async function fetchUserID (username: string) {
	const user = await client.v2.userByUsername(username);
	if (user.errors?.length) {
		const error = new Error(user.errors[0].detail);
		error.name = user.errors[0].title;
		throw error;
	}
	return user.data.id;
}

async function fetchTimeline (userID: string, options: {
	includeReplies: boolean,
	includeRetweets: boolean,
	includeQuoteTweets: boolean,
}) {
	const timeline = await client.v2.userTimeline(userID, {
		'max_results': 100,
	});
	if (timeline.errors.length) {
		const error = new Error(timeline.errors[0].detail);
		error.name = timeline.errors[0].title;
		throw error;
	}

	// filter reported tweets based on what was requested
	return timeline.tweets.filter(tweet => {
		// always include tweets with no relationships
		if (!tweet.referenced_tweets?.length) {
			return true;
		}

		// include the tweet if one of its relationships is one we don't want
		return tweet.referenced_tweets.every(referencedTweet => {
			if (!options.includeReplies && referencedTweet.type === 'replied_to') {
				return false;
			}
			if (!options.includeRetweets && referencedTweet.type === 'retweeted') {
				return false;
			}
			if (!options.includeQuoteTweets && referencedTweet.type === 'quoted') {
				return false;
			}
			return true;
		})
	});
}

const buildFeed = ({username, tweets}: {
	username: string,
	tweets: Array<{
		id: string,
		text: string,
		authorName?: string,
	}>
}) => `
	<?xml version="1.0"?>
	<rss version="2.0">
		<channel>
			<title>@${xmlEscape(username)}'s tweets</title>
			<link>https://twitter.com/${xmlEscape(username)}</link>
			<description>Posts from @${xmlEscape(username)} on Twitter</description>
			${tweets.map(tweet => `
				<item>
					<guid>${xmlEscape(tweet.id)}</guid>
					<link>https://twitter.com/i/status/${xmlEscape(tweet.id)}</link>
					<description>${xmlEscape(tweet.text)}</description>
				</item>
			`).join('')}
		</channel>
	</rss>
`;

express()
	.get('/users/by-username/:username', async (request, response, next) => {
		try {
			const userID = await fetchUserID(request.params.username);
			request.url = `/users/by-id/${encodeURIComponent(userID)}`;
			next();
		} catch (error) {
			console.error(error);
			response.status(500);
			response.end();
		}
	})
	.get('/users/by-id/:userID', async (request, response) => {
		const {userID} = request.params;

		const includeReplies = request.query.includeReplies === 'true';
		const includeRetweets = request.query.includeRetweets === 'true';
		const includeQuoteTweets = request.query.includeQuoteTweets === 'true';

		try {
			const tweets = await fetchTimeline(userID, {
				includeReplies,
				includeRetweets,
				includeQuoteTweets,
			});

			const feed = buildFeed({
				username: 'eritbh',
				tweets: tweets.map(tweet => ({
					id: tweet.id,
					text: tweet.text,
				})),
			});

			response.status(200);
			response.setHeader('Content-Type', 'application/rss+xml');
			response.end(feed);
		} catch (error) {
			console.error(error);
			response.status(500);
			response.end();
		}
	})
	.listen(process.env.PORT || 4567, () => {
		console.log('Listening!');
	})
