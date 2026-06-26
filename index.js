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

// ID Owner Server (Lord) & ID Channel Level Up
const OWNER_ID = '1180180812327559310'; 
const LEVEL_UP_CHANNEL_ID = '1475801714425860272'; 
const HOGWARTS_GIF = 'https://cdn.discordapp.com/attachments/1502882871612805283/1502886909570060339/-4.gif?ex=6a3ea5c1&is=6a3d5441&hm=c230bca22b037a6bdd70b38daeddd5f2f42302ad62a08939374aeb8b22279f07&';

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

// RUMUS DINAMIS TARGET XP (Makin tinggi level, makin susah)
function getXpNeededForNextLevel(level) {
    if (level >= 500) {
        return Math.floor(500 * Math.pow(level, 1.5)); // Level 500-1000: Sangat Hardcore
    } else {
        return level * 500; // Level 1-499: Normal / Possible
    }
}

// DAFTAR GELAR SIHIR HARRY POTTER LENGKAP (1 - 1000+)
function getWizardTitle(level, userId) {
    if (userId === OWNER_ID) return '👑 Lord of Magic';
    if (level >= 900) return '🧙‍♂️ Ancient Archmage';
    if (level >= 800) return '🏛️ Grand Sorcerer of the Order';
    if (level >= 700) return '📜 Chief Warlock of the Wizengamot';
    if (level >= 600) return '🛡️ Order of the Merlin (First Class)';
    if (level >= 500) return '🏰 Auror Commander';
    if (level >= 400) return '🦅 Senior Undersecretary';
    if (level >= 300) return '🦁 Department Head of Magic';
    if (level >= 200) return '🧹 Elite Auror Office';
    if (level >= 150) return '🧪 Master Alchemist';
    if (level >= 100) return '🔮 Ministry of Magic Official';
    if (level >= 75)  return '🌟 Hogwarts Head Boy / Head Girl';
    if (level >= 50)  return '🦡 Hogwarts Prefect';
    if (level >= 40)  return '🎓 Hogwarts Graduate';
    if (level >= 35)  return '🧹 Seventh Year (N.E.W.T. Level)';
    if (level >= 30)  return '📚 Sixth Year';
    if (level >= 25)  return '🧪 Fifth Year (O.W.L. Level)';
    if (level >= 20)  return '🛡️ Fourth Year';
    if (level >= 15)  return '🦅 Third Year';
    if (level >= 10)  return '📜 Second Year';
    if (level >= 5)   return '🌱 First Year';
    return '🌱 New Student';
}

// Pengaturan Rumah Asrama (Sorting Hat)
const houses = [
    { id: '1475605712938864796', name: '🦁 Gryffindor' },
    { id: '1475786100210401413', name: '🐍 Slytherin' },
    { id: '1475786808167235604', name: '🦅 Ravenclaw' },
    { id: '1475787032759631965', name: '🦡 Hufflepuff' }
];

const xpCooldowns = new Set();

client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// EVENT HANDLER CHAT (Sistem Leveling, Perintah Admin, & Fitur Seru)
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const args = message.content.split(' ');
    const command = args[0].toLowerCase();

    const levelUpChannel = message.guild.channels.cache.get(LEVEL_UP_CHANNEL_ID) || message.channel;

    // ==========================================
    // A. COMMAND KHUSUS OWNER (ADMIN COMMANDS)
    // ==========================================
    
    // 1. Perintah !setlevel @User <angka>
    if (command === '!setlevel') {
        if (userId !== OWNER_ID) {
            return message.reply('❌ Kamu tidak memiliki otoritas kekuatan sihir (Hanya untuk Lord Server)!');
        }

        const targetUser = message.mentions.users.first();
        const newLevel = parseInt(args[2]);

        if (!targetUser || isNaN(newLevel)) {
            return message.reply('🔮 **Format Salah!** Gunakan: `!setlevel @User <angka_level>`');
        }

        if (targetUser.id !== OWNER_ID && newLevel > 1000) {
            return message.reply('❌ Batas maksimal tingkat level untuk penyihir biasa (member) adalah Level 1000!');
        }
        if (targetUser.id === OWNER_ID && newLevel > 9999) {
            return message.reply('❌ Batas maksimal kekuatan Lord adalah Level 9999!');
        }

        let db = getUserData();
        if (!db[targetUser.id]) db[targetUser.id] = { xp: 0, level: 1 };

        db[targetUser.id].level = newLevel;
        db[targetUser.id].xp = 0; 
        saveUserData(db);

        // Kirim notifikasi embed ke channel level up khusus
        const newTitle = getWizardTitle(newLevel, targetUser.id);
        const adminSetEmbed = new EmbedBuilder()
            .setColor('#25a5cf')
            .setTitle('✨ Hogwarts Power Awakening!')
            .setDescription(`Kekuatan sihir <@${targetUser.id}> telah disesuaikan oleh Lord! Berada di **Level ${newLevel}** dengan gelar **${newTitle}**! 🎓`)
            .setImage(HOGWARTS_GIF)
            .setTimestamp();

        await levelUpChannel.send({ embeds: [adminSetEmbed] });

        return message.reply(`✅ Berhasil mengubah tingkat sihir ${targetUser} menjadi **Level ${newLevel}**!`);
    }

    // 2. Perintah !addlevel @User <angka>
    if (command === '!addlevel') {
        if (userId !== OWNER_ID) {
            return message.reply('❌ Kamu tidak memiliki otoritas kekuatan sihir (Hanya untuk Lord Server)!');
        }

        const targetUser = message.mentions.users.first();
        const levelToAdd = parseInt(args[2]);

        if (!targetUser || isNaN(levelToAdd)) {
            return message.reply('🔮 **Format Salah!** Gunakan: `!addlevel @User <jumlah_level>`');
        }

        let db = getUserData();
        if (!db[targetUser.id]) db[targetUser.id] = { xp: 0, level: 1 };

        const finalLevel = db[targetUser.id].level + levelToAdd;

        if (targetUser.id !== OWNER_ID && finalLevel > 1000) {
            return message.reply('❌ Penambahan level gagal! Tingkat member biasa tidak boleh menembus Level 1000.');
        }
        if (targetUser.id === OWNER_ID && finalLevel > 9999) {
            return message.reply('❌ Tingkat kekuatan Lord tidak bisa melebihi Level 9999.');
        }

        db[targetUser.id].level = finalLevel;
        saveUserData(db);

        // Kirim notifikasi embed ke channel level up khusus
        const newTitle = getWizardTitle(finalLevel, targetUser.id);
        const adminAddEmbed = new EmbedBuilder()
            .setColor('#25a5cf')
            .setTitle('✨ Hogwarts Academy Level Up!')
            .setDescription(`Selamat! <@${targetUser.id}> mendapatkan berkah tingkat sihir tambahan dan naik ke **Level ${finalLevel}** bergelar **${newTitle}**! 🎓`)
            .setImage(HOGWARTS_GIF)
            .setTimestamp();

        await levelUpChannel.send({ embeds: [adminAddEmbed] });

        return message.reply(`✅ Berhasil menambahkan +${levelToAdd} level ke ${targetUser}. Sekarang berada di **Level ${finalLevel}**!`);
    }

    // ==========================================
    // B. FUN COMMANDS & TEST COMMANDS
    // ==========================================

    if (command === '!levelup') {
        const testEmbed = new EmbedBuilder()
            .setColor('#25a5cf')
            .setTitle('✨ Hogwarts Academy Level Up!')
            .setDescription(`Selamat! ${message.author} telah naik ke **Level 2** dan sekarang bergelar **🌱 First Year**! 🎓`)
            .setImage(HOGWARTS_GIF)
            .setTimestamp();

        await levelUpChannel.send({ embeds: [testEmbed] });
        if (levelUpChannel.id !== message.channel.id) {
            message.reply('✅ Pesan simulasi level-up telah dikirim ke channel khusus!');
        }
        return; 
    }

    if (command === '!sortinghat') {
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

        await message.channel.send({ embeds: [embed], components: [row] });
        return;
    }

    // ==========================================
    // C. AUTOMATIC XP & LEVELING SYSTEM (DILOCK ROLE)
    // ==========================================
    if (!xpCooldowns.has(userId)) {
        try {
            const hasHouseRole = message.member.roles.cache.some(role => houses.some(house => house.id === role.id));
            
            if (!hasHouseRole && userId !== OWNER_ID) {
                return; 
            }

            let db = getUserData();

            if (!db[userId]) {
                db[userId] = { xp: 0, level: 1 };
            }

            if (userId !== OWNER_ID && db[userId].level >= 1000) return;
            if (userId === OWNER_ID && db[userId].level >= 9999) return;

            const xpGained = Math.floor(Math.random() * 11) + 15;
            db[userId].xp += xpGained;

            const xpNeeded = getXpNeededForNextLevel(db[userId].level);

            if (db[userId].xp >= xpNeeded) {
                db[userId].xp -= xpNeeded; 
                db[userId].level += 1; 

                const newTitle = getWizardTitle(db[userId].level, userId);

                const levelUpEmbed = new EmbedBuilder()
                    .setColor('#25a5cf')
                    .setTitle('✨ Hogwarts Academy Level Up!')
                    .setDescription(`Selamat! <@${userId}> telah naik ke **Level ${db[userId].level}** dan sekarang bergelar **${newTitle}**! 🎓`)
                    .setImage(HOGWARTS_GIF)
                    .setTimestamp();

                await levelUpChannel.send({ embeds: [levelUpEmbed] });
            }

            saveUserData(db);

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