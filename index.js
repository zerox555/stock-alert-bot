require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const axios = require('axios');
const fs = require('fs');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const ALERTS_FILE = 'alerts.json';

// Load alerts from file
let alerts = {};
if (fs.existsSync(ALERTS_FILE)) {
    alerts = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8'));
}

// Save alerts to file
function saveAlerts() {
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(alerts, null, 2));
}

// Fetch stock price
async function getStockPrice(symbol) {
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;
    const response = await axios.get(url);
    const data = response.data['Global Quote'];
    return parseFloat(data['05. price']);
}

// Check alerts periodically
setInterval(async () => {
    for (const userId in alerts) {
        for (const symbol in alerts[userId]) {
            const { price, condition } = alerts[userId][symbol];
            try {
                const currentPrice = await getStockPrice(symbol);
                let shouldTrigger = false;

                if (condition === '>' && currentPrice >= price) {
                    shouldTrigger = true;
                } else if (condition === '<' && currentPrice <= price) {
                    shouldTrigger = true;
                }

                if (shouldTrigger) {
                    const user = await client.users.fetch(userId);
                    user.send(`🚨 Alert: **${symbol}** is now at $${currentPrice} (${condition} $${price})`);
                    delete alerts[userId][symbol]; // Remove triggered alert
                    saveAlerts();
                }
            } catch (error) {
                console.error(`Error checking alert for ${symbol}:`, error);
            }
        }
    }
}, 30000); // Check every 60 seconds

// Event: When the bot is ready
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Event: When a message is sent
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Help command
    if (message.content.startsWith('!help')) {
        const helpMessage = `
**📖 Available Commands:**

1. **Set an Alert**:
   - Usage: \`!alert add <symbol> > or < <price>\`
   - Example: \`!alert add AAPL > 150\` (Alert when AAPL is above $150)
   - Example: \`!alert add TSLA < 700\` (Alert when TSLA is below $700)

2. **Remove an Alert**:
   - Usage: \`!alert remove <symbol>\`
   - Example: \`!alert remove AAPL\`

3. **List Alerts**:
   - Usage: \`!alert list\`
   - Displays all your active alerts.

4. **Get Stock Price**:
   - Usage: \`!stock <symbol>\`
   - Example: \`!stock AAPL\`

5. **Help**:
   - Usage: \`!help\`
   - Displays this help message.
`;
        message.reply(helpMessage);
        return;
    }

    // Add alert
    if (message.content.startsWith('!alert add')) {
        const args = message.content.split(' ');
        const symbol = args[2]?.toUpperCase();
        const condition = args[3];
        const price = parseFloat(args[4]);

        if (!symbol || !['>', '<'].includes(condition) || isNaN(price)) {
            return message.reply('Usage: `!alert add <symbol> > or < <price>`');
        }

        const userId = message.author.id;
        if (!alerts[userId]) alerts[userId] = {};
        alerts[userId][symbol] = { price, condition };
        saveAlerts();

        message.reply(`Alert set for **${symbol}** when price is ${condition} $${price}`);
    }

    // Remove alert
    if (message.content.startsWith('!alert remove')) {
        const args = message.content.split(' ');
        const symbol = args[2]?.toUpperCase();

        if (!symbol) {
            return message.reply('Usage: `!alert remove <symbol>`');
        }

        const userId = message.author.id;
        if (alerts[userId]?.[symbol]) {
            delete alerts[userId][symbol];
            saveAlerts();
            message.reply(`Alert removed for **${symbol}**`);
        } else {
            message.reply(`No alert found for **${symbol}**`);
        }
    }

    // List alerts
    if (message.content.startsWith('!alert list')) {
        const userId = message.author.id;
        const userAlerts = alerts[userId];

        if (!userAlerts || Object.keys(userAlerts).length === 0) {
            return message.reply('You have no active alerts.');
        }

        const alertList = Object.entries(userAlerts)
            .map(([symbol, { price, condition }]) => `**${symbol}**: ${condition} $${price}`)
            .join('\n');
        message.reply(`Your active alerts:\n${alertList}`);
    }

    // Get stock price
    if (message.content.startsWith('!stock')) {
        const args = message.content.split(' ');
        const symbol = args[1]?.toUpperCase();

        if (!symbol) {
            return message.reply('Usage: `!stock <symbol>`');
        }

        try {
            const price = await getStockPrice(symbol);
            message.reply(`**${symbol}** is currently at $${price}`);
        } catch (error) {
            console.error('Error fetching stock data:', error);
            message.reply('An error occurred while fetching stock data. Please try again later.');
        }
    }
});

// Log in to Discord
client.login(process.env.DISCORD_BOT_TOKEN);