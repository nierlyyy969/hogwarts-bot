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
// PENGATURAN HOGWARTS
// ==========================================
const OWNER_ID = '1180180812327559310'; 
const LEVEL_UP_CHANNEL_ID = '1475801714425860272'; 

const houses = [
    { id: '1475605712938864796', name: 'Gryffindor', emoji: '🦁', color: '#740001', accent: '#e3a00e', logo: 'https://i.imgur.com/1go5VXj.png' },
    { id: '1475786100210401413', name: 'Slytherin', emoji: '🐍', color: '#1a472a', accent: '#aaaaaa', logo: 'https://i.imgur.com/gPLI7Fo.png' },
    { id: '1475786808167235604', name: 'Ravenclaw', emoji: '🦅', color: '#0e1a40', accent: '#946b2d', logo: 'https://i.imgur.com/SiyKVTW.png' },
    { id: '1475787032759631965', name: 'Hufflepuff', emoji: '🦡', color: '#ffcc00', accent: '#000000', logo: 'https://i.imgur.com/7PyCEAA.png' }
];

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
    }
    return level * 500;
}

function getWizardTitle(level, userId) {
    if (userId === OWNER_ID) return 'Lord of magic';
    if (level >= 900) return 'Ancient Archmage';
    if (level >= 800) return 'Grand Sorcerer';
    if (level >= 700) return 'Chief Warlock';
    if (level >= 600) return 'Order of the Merlin';
    if (level >= 500) return 'Auror Commander';
    if (level >= 400) return 'Undersecretary';
    if (level >= 300) return 'Department Head';
    if (level >= 200) return 'Elite Auror';
    if (level >= 150) return 'Master Alchemist';
    if (level >= 100) return 'Ministry Official';
    if (level >= 75)  return 'Head Boy / Head Girl';
    if (level >= 50)  return 'Prefect';
    if (level >= 40)  return 'Hogwarts Graduate';
    if (level >= 35)  return 'Seventh Year';
    if (level >= 30)  return 'Sixth Year';
    if (level >= 25)  return 'Fifth Year (O.W.L.)';
    if (level >= 20)  return 'Fourth Year';
    if (level >= 15)  return 'Third Year';
    if (level >= 10)  return 'Second Year';
    if (level >= 5)   return 'First Year';
    return 'New Student';
}

const xpCooldowns = new Set();

client.once(Events.ClientReady, () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// ==========================================
// 🪄 CANVAS MURNI: GENERATOR KARTU PROFIL
// ==========================================
async function generateProfileCard(userData, user, guildMember, triggerUser) {
    // Ukuran kanvas proporsional (mengikuti referensi)
    const canvas = createCanvas(1000, 600);
    const ctx = canvas.getContext('2d');

    const houseObj = houses.find(h => guildMember.roles.cache.has(h.id));
    const houseColor = houseObj ? houseObj.color : '#2e2e2e';
    const houseName = houseObj ? houseObj.name : 'MUGGLE';

    // 1. Latar Belakang Krem Klasik / Kulit Kuno
    ctx.fillStyle = '#f2eade';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Bingkai / Border Luar
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#4a3b32';
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#8c7853';
    ctx.strokeRect(26, 26, canvas.width - 52, canvas.height - 52);

    // 3. Header "PROFILE WIZARD" (Pita Hitam Atas)
    ctx.fillStyle = '#211c18'; // Pita hitam
    ctx.fillRect(160, 45, 680, 45);
    ctx.strokeStyle = '#4a3b32';
    ctx.lineWidth = 2;
    ctx.strokeRect(160, 45, 680, 45);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PROFILE WIZARD', 500, 75);

    // Subheader Kotak Asrama (Tepat di bawah pita header)
    ctx.fillStyle = '#d4cbb8'; // Kotak abu/krem
    ctx.fillRect(360, 100, 280, 30);
    ctx.strokeStyle = '#8c7853';
    ctx.strokeRect(360, 100, 280, 30);

    ctx.fillStyle = '#211c18';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(houseName, 500, 121);

    // 4. Avatar (Kiri) & Label usn discord di bawahnya
    // Lingkaran Avatar
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#4a3b32';
    ctx.beginPath();
    ctx.arc(160, 260, 70, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();

    try {
        const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 }));
        ctx.save();
        ctx.beginPath();
        ctx.arc(160, 260, 66, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, 94, 194, 132, 132);
        ctx.restore();
    } catch (e) {
        console.error('Gagal memuat avatar:', e);
    }

    // Kotak Label usn discord (di bawah avatar)
    ctx.fillStyle = '#4a3b32';
    ctx.fillRect(75, 345, 170, 30);
    ctx.strokeStyle = '#211c18';
    ctx.strokeRect(75, 345, 170, 30);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(triggerUser.username, 160, 365);

    // 5. Kotak Logo Asrama (Tengah - Warna Hijau/Sesuai Asrama)
    ctx.fillStyle = houseColor;
    ctx.fillRect(310, 160, 380, 180);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#4a3b32';
    ctx.strokeRect(310, 160, 380, 180);

    // Memuat logo asrama di dalam kotak tengah
    if (houseObj && houseObj.logo) {
        try {
            const houseLogo = await loadImage(houseObj.logo);
            // Gambar logo dengan ukuran proporsional di tengah kotak
            ctx.drawImage(houseLogo, 395, 175, 210, 210);
        } catch (e) {
            console.error('Gagal memuat logo asrama:', e);
        }
    }

    // 6. Kotak Gelar / Title (Kanan)
    ctx.fillStyle = '#362d26'; // Kotak coklat tua
    ctx.fillRect(730, 160, 200, 180);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#4a3b32';
    ctx.strokeRect(730, 160, 200, 180);

    // Label (gelar) di dalam kotak kanan
    ctx.fillStyle = '#c2b193';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('(gelar)', 830, 200);

    const title = getWizardTitle(userData.level, user.id);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(title, 830, 240);

    // 7. Pita Panjang Bawah (Level & Progress XP)
    const xpNeeded = getXpNeededForNextLevel(userData.level);
    const displayLevelText = `[lvl. ${userData.level} ${userData.xp}/${xpNeeded}]`;

    ctx.fillStyle = '#d4cbb8'; // Pita bawah
    ctx.fillRect(75, 430, 850, 60);
    ctx.strokeStyle = '#4a3b32';
    ctx.lineWidth = 3;
    ctx.strokeRect(75, 430, 850, 60);

    // Teks Level & XP di dalam pita bawah
    ctx.fillStyle = '#211c18';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(displayLevelText, 500, 472);

    return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'profile.png' });
}

// ==========================================
// EVENT HANDLER CHAT
// ==========================================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const args = message.content.split(' ');
    const command = args[0].toLowerCase();

    const levelUpChannel = message.guild.channels.cache.get(LEVEL_UP_CHANNEL_ID) || message.channel;
    const userHouseObj = houses.find(h => message.member.roles.cache.has(h.id));

    // A. ADMIN COMMANDS (Hanya Lord/Owner Server)
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

    // Khusus Owner/Lord Server
    if (command === '!levelup') {
        if (userId !== OWNER_ID) return message.reply('❌ Perintah ini khusus untuk Lord of Magic!');
        const testEmbed = new EmbedBuilder()
            .setColor('#25a5cf')
            .setTitle('✨ Hogwarts Academy Level Up!')
            .setDescription(`Selamat! ${message.author} telah naik level! 🎓`)
            .setTimestamp();

        await levelUpChannel.send({ embeds: [testEmbed] });
        if (levelUpChannel.id !== message.channel.id) {
            message.reply('✅ Pesan simulasi level-up telah dikirim ke channel khusus!');
        }
        return; 
    }

    // B. GENERAL MAGICAL COMMANDS (Dapat digunakan semua member)
    if (command === '!profile') {
        const loadingMessage = await message.reply('✨ Meracik lembar profil magis dari arsip Hogwarts...');

        const targetUser = message.mentions.users.first() || message.author;
        const targetMember = message.guild.members.cache.get(targetUser.id);
        
        let db = getDbData();
        const userData = db.users[targetUser.id] || { xp: 0, level: 1, pointsContributed: 0 };
        
        try {
            const profileAttachment = await generateProfileCard(userData, targetUser, targetMember, message.author);
            await message.channel.send({ content: `Penyihir ${message.author}, inilah lembar arsip sihir dari profil **${targetUser.username}**:`, files: [profileAttachment] });
            loadingMessage.delete();
        } catch (error) {
            console.error('Gagal meracik kanvas profil:', error);
            loadingMessage.edit('❌ Gagal meracik sihir profil.');
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