require('dotenv').config();

const {
    Client,
    GatewayIntentBits,
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI)
const fs = require('fs');
const path = require('path');
const dataPath = path.join(__dirname, 'users.json');

// Fungsi pembantu untuk membaca dan menulis data level
function getUserData() {
    if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
}
function saveUserData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// Kalibrasi Event Message
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // ----- PERINTAH TES INSTAN -----
    if (message.content === '!levelup') {
        const levelUpChannelId = 'ID_CHANNEL_LEVEL_UP_KAMU'; // Ganti dengan ID channel asli jika mau khusus
        const targetChannel = message.guild.channels.cache.get(levelUpChannelId) || message.channel;
        return targetChannel.send(`✨ **Selamat!** ${message.author} telah naik ke **Level 2** dan sekarang bergelar **🌱 First Year**! 🎓`);
    }

    // ----- SISTEM XP LOKAL -----
    let db = getUserData();
    const userId = message.author.id;

    if (!db[userId]) {
        db[userId] = { xp: 0, level: 1 };
    }

    // Tambah XP acak 15-25
    db[userId].xp += Math.floor(Math.random() * 11) + 15;

    // Cek naik level (misal per level butuh 500 XP)
    let nextLevelXp = db[userId].level * 500;
    if (db[userId].xp >= nextLevelXp) {
        db[userId].level += 1;
        message.channel.send(`✨ **Selamat!** ${message.author} telah naik ke **Level ${db[userId].level}**! 🎓`);
    }

    saveUserData(db);
});

  .then(() => console.log('Sukses terhubung ke Database Hogwarts!'))
  .catch(err => console.error('Gagal terhubung ke database:', err));

const houses = [
    {
        id: '1475605712938864796',
        name: '🦁 Gryffindor'
    },
    {
        id: '1475786100210401413',
        name: '🐍 Slytherin'
    },
    {
        id: '1475786808167235604',
        name: '🦅 Ravenclaw'
    },
    {
        id: '1475787032759631965',
        name: '🦡 Hufflepuff'
    }
];

client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {

const User = require('./models/User'); 
const LEVEL_UP_CHANNEL_ID = '1475801714425860272'; 

function getWizardTitle(level) {
    if (level >= 50) return '🧙‍♂️ Headmaster';
    if (level >= 40) return '🛡️ Professor';
    if (level >= 35) return '🎓 Graduate';
    if (level >= 30) return '🧹 Seventh Year';
    if (level >= 25) return '🦁 Sixth Year';
    if (level >= 20) return '🐍 Fifth Year';
    if (level >= 15) return '🦡 Fourth Year';
    if (level >= 10) return '🦅 Third Year';
    if (level >= 5)  return '📜 Second Year';
    return '🌱 First Year';
}

const xpCooldowns = new Set();

if (!message.author.bot && message.guild) {
    const userId = message.author.id;
    const guildId = message.guild.id;

    if (!xpCooldowns.has(userId)) {
        try {
            let userData = await User.findOne({ userId, guildId });
            if (!userData) {
                userData = await User.create({ userId, guildId });
            }

            const xpGained = Math.floor(Math.random() * 11) + 15;
            userData.xp += xpGained;

            const xpNeeded = userData.level * 500;

            if (userData.xp >= xpNeeded) {
                userData.xp -= xpNeeded;
                userData.level += 1;
                
                const newTitle = getWizardTitle(userData.level);
                const levelUpChannel = message.guild.channels.cache.get(LEVEL_UP_CHANNEL_ID);
                
                if (levelUpChannel) {
                    levelUpChannel.send(`✨ **Selamat!** <@${userId}> telah naik ke **Level ${userData.level}** dan sekarang bergelar **${newTitle}**! 🎓`);
                }
            }

if (message.content === '!levelup') {
    
    if (message.author.bot) return;

   
    const levelUpChannelId = '1475801714425860272'; 
    const targetChannel = message.guild.channels.cache.get(levelUpChannelId) || message.channel;

    
    targetChannel.send(`✨ **Selamat!** ${message.author} telah naik ke **Level 2** dan sekarang bergelar **🌱 First Year**! 🎓`);
    
   
    if (targetChannel.id !== message.channel.id) {
        message.reply('✅ Pesan simulasi level-up telah dikirim ke channel khusus!');
    }
}

            await userData.save();

            xpCooldowns.add(userId);
            setTimeout(() => xpCooldowns.delete(userId), 60000);

        } catch (err) {
            console.error('Ada masalah saat memproses XP:', err);
        }
    }
}
    if (message.author.bot) return;

    if (message.content === '!sortinghat') {

        const embed = new EmbedBuilder()
    .setColor('#25a5cf')
    .setTitle('🎩 The Sorting Hat')
    .setDescription(
        'Welcome to **Hogwarts Academy**\n\nSilahkan tekan tombol di bawah dan biarkan Sorting Hat menentukan kelasmu!'
    )
    .setFooter({
        text: 'Hogwarts Academy • House Selection'
    })
    .setTimestamp()
    .setImage('https://cdn.discordapp.com/attachments/1502882871612805283/1502886909570060339/-4.gif?ex=6a3dfd01&is=6a3cab81&hm=f39de21ab9f12324d2322953b00b22a4c3e5ec4d13ceeb8ecc03ef5e5f89a591&');

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
    .setCustomId('sorting_hat')
    .setLabel('Mencari Kelas')
    .setEmoji('🎩')
    .setStyle(ButtonStyle.Success)
            );

        await message.channel.send({
            embeds: [embed],
            components: [row]
        });
    }
});

client.on(Events.InteractionCreate, async interaction => {

    if (!interaction.isButton()) return;
    if (interaction.customId !== 'sorting_hat') return;

    const member = interaction.member;

    const alreadySorted = houses.some(house =>
        member.roles.cache.has(house.id)
    );

    if (alreadySorted) {
        return interaction.reply({
            content: '🎩 You have already been sorted into a House!',
            ephemeral: true
        });
    }

    const randomHouse =
        houses[Math.floor(Math.random() * houses.length)];

    await member.roles.add(randomHouse.id);

    await interaction.reply({
        content: `🎩 The Sorting Hat has chosen...\n\n${randomHouse.name}!`,
        ephemeral: true
    });
});

client.login(process.env.TOKEN);