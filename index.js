require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

const {
    Client,
    GatewayIntentBits,
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    AttachmentBuilder
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// ==========================================
// PENGATURAN GLOBAL HOGWARTS
// ==========================================
const OWNER_ID = '1180180812327559310'; 
const LEVEL_UP_CHANNEL_ID = '1475801714425860272'; 

// Direct Link Aset Perkamen & Logo Asrama
const MAIN_BG_URL = 'https://i.imgur.com/1gKWPaA.png'; 

const houses = [
    { 
        id: '1475605712938864796', 
        name: 'Gryffindor', 
        emoji: '🦁', 
        img: 'https://i.imgur.com/1go5VXj.png' 
    },
    { 
        id: '1475786100210401413', 
        name: 'Slytherin', 
        emoji: '🐍', 
        img: 'https://i.imgur.com/gPLI7Fo.png' 
    },
    { 
        id: '1475786808167235604', 
        name: 'Ravenclaw', 
        emoji: '🦅', 
        img: 'https://i.imgur.com/SiyKVTW.png' 
    },
    { 
        id: '1475787032759631965', 
        name: 'Hufflepuff', 
        emoji: '🦡', 
        img: 'https://i.imgur.com/7PyCEAA.png' 
    }
];

// Setup Penyimpanan JSON Lokal
const dataPath = path.join(__dirname, 'users.json');

function getDbData() {
    if (!fs.existsSync(dataPath)) {
        fs.writeFileSync(dataPath, JSON.stringify({ users: {}, housePoints: { 'Gryffindor': 0, 'Slytherin': 0, 'Ravenclaw': 0, 'Hufflepuff': 0 } }, null, 2));
    }
    return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
}

function saveDbData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function getXpNeededForNextLevel(level) {
    if (level >= 500) {
        return Math.floor(500 * Math.pow(level, 1.5));
    } else {
        return level * 500;
    }
}

function getWizardTitle(level, userId) {
    if (userId === OWNER_ID) return '👑 Lord of Magic';
    if (level >= 900) return '🧙‍♂️ Ancient Archmage';
    if (level >= 800) return '🏛️ Grand Sorcerer';
    if (level >= 700) return '📜 Chief Warlock';
    if (level >= 600) return '🛡️ Order of the Merlin';
    if (level >= 500) return '🏰 Auror Commander';
    if (level >= 400) return '🦅 Undersecretary';
    if (level >= 300) return '🦁 Department Head';
    if (level >= 200) return '🧹 Elite Auror';
    if (level >= 150) return '🧪 Master Alchemist';
    if (level >= 100) return '🔮 Ministry Official';
    if (level >= 75)  return '🌟 Head Boy / Head Girl';
    if (level >= 50)  return '🦡 Prefect';
    if (level >= 40)  return '🎓 Hogwarts Graduate';
    if (level >= 35)  return '🧹 Seventh Year';
    if (level >= 30)  return '📚 Sixth Year';
    if (level >= 25)  return '🧪 Fifth Year (O.W.L.)';
    if (level >= 20)  return '🛡️ Fourth Year';
    if (level >= 15)  return '🦅 Third Year';
    if (level >= 10)  return '📜 Second Year';
    if (level >= 5)   return '🌱 First Year';
    return '🌱 New Student';
}

const xpCooldowns = new Set();

client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// ==========================================
// 🪄 SISTEM GENERATOR PROFIL (CANVAS)
// ==========================================
async function generateProfileCard(userData, user, guildMember) {
    const canvas = createCanvas(1200, 750);
    const ctx = canvas.getContext('2d');

    // 1. Gambar Latar Belakang Perkamen Antik Hogwarts
    const background = await loadImage(MAIN_BG_URL);
    ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

    // 2. Muat Avatar Discord user
    const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 512 }));
    
    // 3. Tentukan Logo Asrama User (Jika ada)
    const houseObj = houses.find(h => guildMember?.roles.cache.has(h.id));

    // --- MENGGAMBAR AVATAR ---
    // Potongan melingkar untuk avatar (x: 200, y: 350, jari-jari 110)
    ctx.save();
    ctx.beginPath();
    ctx.arc(200, 350, 110, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 90, 240, 220, 220); 
    ctx.restore();

    // Bingkai perak avatar
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#b0b7bd'; 
    ctx.beginPath();
    ctx.arc(200, 350, 110, 0, Math.PI * 2, true);
    ctx.stroke();

    // --- MENGGAMBAR LOGO ASRAMA ---
    if (houseObj) {
        const houseLogo = await loadImage(houseObj.img);
        // Posisi logo asrama di plakat tengah ledger (x: 480, y: 220, ukuran 240x240)
        ctx.drawImage(houseLogo, 480, 220, 240, 240);
    }

    // --- MENGGAMBAR TEKS & DATA ---
    ctx.textAlign = 'left';
    ctx.fillStyle = '#2c221e'; // Tinta antik

    // Username di bawah avatar
    ctx.font = '32px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(user.username, 200, 490);

    // Level & Gelar (Kanan)
    ctx.textAlign = 'left';
    ctx.font = '72px Georgia, serif';
    ctx.fillText(`Level ${userData.level}`, 800, 330);

    const title = getWizardTitle(userData.level, user.id);
    ctx.font = '36px Georgia, serif';
    ctx.fillStyle = user.id === OWNER_ID ? '#b38f00' : '#2c221e'; // Emas untuk Lord
    ctx.fillText(title, 800, 380);

    // House Cup Contribution (Bawah kanan)
    ctx.fillStyle = '#2c221e';
    ctx.font = '32px Georgia, serif';
    ctx.fillText(`${userData.pointsContributed.toLocaleString()} Points`, 850, 615);

    // --- MENGGAMBAR PROGRESS BAR XP (Kiri Bawah) ---
    const xpNeeded = getXpNeededForNextLevel(userData.level);
    const xpPercentage = Math.min(userData.xp / xpNeeded, 1);
    
    // Latar Bar 
    ctx.fillStyle = '#d9cfc1'; 
    ctx.fillRect(280, 615, 400, 40);

    // Isi Bar Progress
    ctx.fillStyle = '#4169e1'; // Biru Sihir
    ctx.fillRect(280, 615, 400 * xpPercentage, 40);

    // Teks Progress XP
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${userData.xp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP`, 480, 642);

    return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'profile.png' });
}

// ==========================================
// EVENT HANDLER CHAT (Sistem Leveling & Command)
// ==========================================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const args = message.content.split(' ');
    const command = args[0].toLowerCase();

    const levelUpChannel = message.guild.channels.cache.get(LEVEL_UP_CHANNEL_ID) || message.channel;
    const userHouseObj = houses.find(h => message.member.roles.cache.has(h.id));

    // A. ADMIN COMMANDS
    if (command === '!setlevel') {
        if (userId !== OWNER_ID) return message.reply('❌ Hanya Lord yang berhak memanipulasi tingkat sihir!');
        const targetUser = message.mentions.users.first();
        const newLevel = parseInt(args[2]);

        if (!targetUser || isNaN(newLevel)) return message.reply('🔮 **Format Salah!** Gunakan: `!setlevel @User <angka_level>`');
        if (targetUser.id !== OWNER_ID && newLevel > 1000) return message.reply('❌ Batas maksimal tingkat sihir member adalah Level 1000!');
        if (targetUser.id === OWNER_ID && newLevel > 9999) return message.reply('❌ Batas maksimal kekuatan Lord adalah Level 9999!');

        let db = getDbData();
        if (!db.users[targetUser.id]) db.users[targetUser.id] = { xp: 0, level: 1, pointsContributed: 0 };

        db.users[targetUser.id].level = newLevel;
        db.users[targetUser.id].xp = 0; 
        saveDbData(db);

        message.reply(`✅ Berhasil mengubah tingkat sihir ${targetUser} menjadi **Level ${newLevel}**!`);
        return;
    }

    if (command === '!givepoint') {
        if (userId !== OWNER_ID) return message.reply('❌ Hanya Lord yang bisa memberikan berkah poin asrama!');
        const targetMember = message.mentions.members.first();
        const points = parseInt(args[2]);

        if (!targetMember || isNaN(points)) return message.reply('🔮 **Format Salah!** Gunakan: `!givepoint @User <jumlah_poin>`');

        const targetHouse = houses.find(h => targetMember.roles.cache.has(h.id));
        if (!targetHouse) return message.reply('❌ Penyihir tersebut belum bergabung dengan asrama Hogwarts mana pun!');

        let db = getDbData();
        if (!db.users[targetMember.id]) db.users[targetMember.id] = { xp: 0, level: 1, pointsContributed: 0 };

        db.housePoints[targetHouse.name] += points;
        db.users[targetMember.id].pointsContributed += points;
        saveDbData(db);

        return message.reply(`🏆 **+${points.toLocaleString()} Poin** telah dianugerahkan ke asrama **${targetHouse.emoji} ${targetHouse.name}** berkat prestasi ${targetMember}!`);
    }

    // B. GENERAL MAGICAL COMMANDS
    if (command === '!profile') {
        const loadingMessage = await message.reply('✨ Meracik lembar profil magis dari arsip Hogwarts...');

        const targetUser = message.mentions.users.first() || message.author;
        const targetMember = message.guild.members.cache.get(targetUser.id);
        
        let db = getDbData();
        const userData = db.users[targetUser.id] || { xp: 0, level: 1, pointsContributed: 0 };
        
        try {
            const profileAttachment = await generateProfileCard(userData, targetUser, targetMember);
            await message.channel.send({ content: `Penyihir ${targetUser}, inilah lembar arsip sihirmu:`, files: [profileAttachment] });
            loadingMessage.delete();
        } catch (error) {
            console.error('Gagal meracik kanvas profil:', error);
            loadingMessage.edit('❌ Gagal meracik sihir profil. Pastikan tautan gambar latar dan asrama sudah benar.');
        }
        return;
    }

    if (command === '!leaderboard') {
        let db = getDbData();
        const sortedHouses = Object.entries(db.housePoints).sort((a, b) => b[1] - a[1]);

        const lbEmbed = new EmbedBuilder()
            .setColor('#25a5cf')
            .setTitle('🏆 House Cup Tournament - Leaderboard')
            .setDescription('Klasemen asrama Hogwarts saat ini:\n\n' + sortedHouses.map((house, index) => {
                const houseMeta = houses.find(h => h.name === house[0]);
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📜';
                return `${medal} **Rank ${index + 1}**: ${houseMeta.emoji} **${house[0]}** — \`${house[1].toLocaleString()} Poin\``;
            }).join('\n'))
            .setFooter({ text: 'Gunakan ketepatan sihir untuk memimpin!' })
            .setTimestamp();

        return message.channel.send({ embeds: [lbEmbed] });
    }

    if (command === '!sortinghat') {
        const embed = new EmbedBuilder()
            .setColor('#25a5cf')
            .setTitle('🎩 The Sorting Hat')
            .setDescription('Welcome to **Hogwarts Academy**\n\nSilahkan tekan tombol di bawah dan biarkan Sorting Hat menentukan kelasmu!')
            .setFooter({ text: 'Hogwarts Academy • House Selection' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('sorting_hat').setLabel('Mencari Kelas').setEmoji('🎩').setStyle(ButtonStyle.Success)
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        return;
    }

    // C. AUTOMATIC XP & LEVELING SYSTEM
    if (!xpCooldowns.has(userId)) {
        try {
            if (!userHouseObj && userId !== OWNER_ID) return; 

            let db = getDbData();
            if (!db.users[userId]) {
                db.users[userId] = { xp: 0, level: 1, pointsContributed: 0 };
            }

            if (userId !== OWNER_ID && db.users[userId].level >= 1000) return;
            if (userId === OWNER_ID && db.users[userId].level >= 9999) return;

            const xpGained = Math.floor(Math.random() * 11) + 15;
            db.users[userId].xp += xpGained;

            if (userHouseObj) {
                db.housePoints[userHouseObj.name] += 1;
                db.users[userId].pointsContributed += 1;
            }

            const xpNeeded = getXpNeededForNextLevel(db.users[userId].level);

            if (db.users[userId].xp >= xpNeeded) {
                db.users[userId].xp -= xpNeeded; 
                db.users[userId].level += 1; 

                const newTitle = getWizardTitle(db.users[userId].level, userId);
                const levelUpEmbed = new EmbedBuilder()
                    .setColor('#25a5cf')
                    .setTitle('✨ Hogwarts Academy Level Up!')
                    .setDescription(`Selamat! <@${userId}> telah naik ke **Level ${db.users[userId].level}** dan sekarang bergelar **${newTitle}**! 🎓`)
                    .setTimestamp();

                await levelUpChannel.send({ embeds: [levelUpEmbed] });
            }

            saveDbData(db);
            xpCooldowns.add(userId);
            setTimeout(() => xpCooldowns.delete(userId), 60000);

        } catch (err) {
            console.error('Masalah saat memproses XP:', err);
        }
    }
});

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
        content: `🎩 The Sorting Hat has chosen...\n\n${randomHouse.emoji} ${randomHouse.name}!`,
        ephemeral: true
    });
});

client.login(process.env.DISCORD_TOKEN);