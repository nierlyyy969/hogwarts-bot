require('dotenv').config();
const fs = require('fs');
const path = require('path');

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

// Setup Penyimpanan Leveling JSON Lokal
const dataPath = path.join(__dirname, 'users.json');

function getUserData() {
    if (!fs.existsSync(dataPath)) {
        fs.writeFileSync(dataPath, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
}

function saveUserData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// Gelar Penyihir Berdasarkan Level
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

// Sistem Cooldown XP (1 Menit)
const xpCooldowns = new Set();
const LEVEL_UP_CHANNEL_ID = '1475801714425860272'; 

// Link Gambar GIF Hogwarts untuk Level Up & Sorting Hat
const HOGWARTS_GIF = 'https://cdn.discordapp.com/attachments/1502882871612805283/1502886909570060339/-4.gif?ex=6a3ea5c1&is=6a3d5441&hm=c230bca22b037a6bdd70b38daeddd5f2f42302ad62a08939374aeb8b22279f07&';

// Pengaturan Rumah Asrama (Sorting Hat)
const houses = [
    { id: '1475605712938864796', name: '🦁 Gryffindor' },
    { id: '1475786100210401413', name: '🐍 Slytherin' },
    { id: '1475786808167235604', name: '🦅 Ravenclaw' },
    { id: '1475787032759631965', name: '🦡 Hufflepuff' }
];

// Event ketika bot aktif
client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// EVENT HANDLER CHAT (Sistem Leveling & Perintah)
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;

    // 1. PERINTAH TES INSTAN (!levelup)
    if (message.content === '!levelup') {
        const targetChannel = message.guild.channels.cache.get(LEVEL_UP_CHANNEL_ID) || message.channel;

        const testEmbed = new EmbedBuilder()
            .setColor('#25a5cf')
            .setTitle('✨ Hogwarts Academy Level Up!')
            .setDescription(`Selamat! ${message.author} telah naik ke **Level 2** dan sekarang bergelar **🌱 First Year**! 🎓`)
            .setImage(HOGWARTS_GIF)
            .setTimestamp();

        await targetChannel.send({ embeds: [testEmbed] });

        if (targetChannel.id !== message.channel.id) {
            message.reply('✅ Pesan simulasi level-up telah dikirim ke channel khusus!');
        }
        return; 
    }

    // 2. PERINTAH SORTING HAT (!sortinghat)
    if (message.content === '!sortinghat') {
        const embed = new EmbedBuilder()
            .setColor('#25a5cf')
            .setTitle('🎩 The Sorting Hat')
            .setDescription('Welcome to **Hogwarts Academy**\n\nSilahkan tekan tombol di bawah dan biarkan Sorting Hat menentukan kelasmu!')
            .setFooter({ text: 'Hogwarts Academy • House Selection' })
            .setTimestamp()
            .setImage(HOGWARTS_GIF);

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
        return;
    }

    // 3. SISTEM LEVELING XP OTOMATIS (Bukan Perintah)
    if (!xpCooldowns.has(userId)) {
        try {
            let db = getUserData();

            // Inisialisasi data jika user baru pertama kali chat
            if (!db[userId]) {
                db[userId] = { xp: 0, level: 1 };
            }

            // Dapatkan XP acak 15-25
            const xpGained = Math.floor(Math.random() * 11) + 15;
            db[userId].xp += xpGained;

            // Hitung kalkulasi target naik level (Level saat ini * 500)
            const xpNeeded = db[userId].level * 500;

            if (db[userId].xp >= xpNeeded) {
                db[userId].xp -= xpNeeded; // Sisa XP disimpan
                db[userId].level += 1; // Level Naik

                const newTitle = getWizardTitle(db[userId].level);
                const levelUpChannel = message.guild.channels.cache.get(LEVEL_UP_CHANNEL_ID) || message.channel;

                // EMBED UTK KELAS UP OTOMATIS MEMBER REALTIME
                const levelUpEmbed = new EmbedBuilder()
                    .setColor('#25a5cf')
                    .setTitle('✨ Hogwarts Academy Level Up!')
                    .setDescription(`Selamat! <@${userId}> telah naik ke **Level ${db[userId].level}** dan sekarang bergelar **${newTitle}**! 🎓`)
                    .setImage(HOGWARTS_GIF)
                    .setTimestamp();

                await levelUpChannel.send({ embeds: [levelUpEmbed] });
            }

            // Simpan perubahan ke file lokal users.json
            saveUserData(db);

            // Aktifkan Cooldown 1 menit
            xpCooldowns.add(userId);
            setTimeout(() => xpCooldowns.delete(userId), 60000);

        } catch (err) {
            console.error('Ada masalah saat memproses XP:', err);
        }
    }
});

// INTERAKSI TOMBOL (Sorting Hat)
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'sorting_hat') return;

    const member = interaction.member;

    const alreadySorted = houses.some(house => member.roles.cache.has(house.id));

    if (alreadySorted) {
        return interaction.reply({
            content: '🎩 You have already been sorted into a House!',
            ephemeral: true
        });
    }

    const randomHouse = houses[Math.floor(Math.random() * houses.length)];

    await member.roles.add(randomHouse.id);

    await interaction.reply({
        content: `🎩 The Sorting Hat has chosen...\n\n${randomHouse.name}!`,
        ephemeral: true
    });
});

client.login(process.env.DISCORD_TOKEN);