require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

// Event: When the bot is ready
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Event: When a message is sent
client.on('messageCreate', async (message) => {
    // Ignore messages from the bot itself
    if (message.author.bot) return;

    // Check if the message starts with "!stock"
    if (message.content.startsWith('!stock')) {
        const args = message.content.split(' ');
        const symbol = args[1]; // Get the stock symbol from the message

        if (!symbol) {
            return message.reply('Please provide a stock symbol. Example: `!stock AAPL`');
        }

        try {
            // Fetch stock data from Alpha Vantage
            const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
            const response = await axios.get(url);

            const data = response.data['Global Quote'];
            if (!data) {
                return message.reply(`Could not find data for symbol: ${symbol}`);
            }

            // Extract relevant data
            const price = data['05. price'];
            const change = data['09. change'];
            const changePercent = data['10. change percent'];

            // Send the data to the Discord channel
            message.reply(
                `**${symbol}**\n` +
                `Price: $${price}\n` +
                `Change: ${change} (${changePercent})`
            );
        } catch (error) {
            console.error('Error fetching stock data:', error);
            message.reply('An error occurred while fetching stock data. Please try again later.');
        }
    }
});

// Log in to Discord
client.login(process.env.DISCORD_BOT_TOKEN);