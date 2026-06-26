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

// ==========================================
// PENGATURAN HOGWARTS
// ==========================================
const OWNER_ID = '1180180812327559310'; 
const LEVEL_UP_CHANNEL_ID = '1475801714425860272'; 

const houses = [
    { id: '1475605712938864796', name: 'Gryffindor', emoji: '🦁' },
    { id: '1475786100210401413', name: 'Slytherin', emoji: '🐍' },
    { id: '1475786808167235604', name: 'Ravenclaw', emoji: '🦅' },
    { id: '1475787032759631965', name: 'Hufflepuff', emoji: '🦡' }
];

const dataPath = path.join(__dirname, 'users.json');

// Membaca database dengan proteksi
function getDbData() {
    if (!fs.existsSync(dataPath)) {
        return { users: {}, housePoints: { 'Gryffindor': 0, 'Slytherin': 0, 'Ravenclaw': 0, 'Hufflepuff': 0 } };
    }
    try {
        const rawData = fs.readFileSync(dataPath, 'utf-8');
        return JSON.parse(rawData);
    } catch (e) {
        return { users: {}, housePoints: { 'Gryffindor': 0, 'Slytherin': 0, 'Ravenclaw': 0, 'Hufflepuff': 0 } };
    }
}

function saveDbData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

// Rumus XP Konsisten: Level * 500 (Jika level >= 500, pakai scaling pangkat)
function getXpNeededForNextLevel(level) {
    if (level >= 500) {
        return Math.floor(500 * Math.pow(level, 1.5));
    }
    return level * 500;
}

// Penentu Gelar Berdasarkan Level
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

// DETEKSI MEMBER KELUAR SERVER (RESET LEVEL)
client.on(Events.GuildMemberRemove, (member) => {
    let db = getDbData();
    if (db.users[member.id]) {
        delete db.users[member.id]; 
        saveDbData(db);
        console.log(`🧹 Data level dari ${member.user.username} telah di-reset karena keluar server.`);
    }
});

// ==========================================
// EVENT HANDLER CHAT (Sistem Utama)
// ==========================================
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const args = message.content.split(' ');
    const command = args[0].toLowerCase();

    const levelUpChannel = message.guild.channels.cache.get(LEVEL_UP_CHANNEL_ID) || message.channel;
    const userHouseObj = houses.find(h => message.member.roles.cache.has(h.id));

    // A. ADMIN COMMANDS (Khusus Lord / Owner Server)
    if (command === '!setlevel') {
        if (userId !== OWNER_ID) return message.reply('❌ Hanya Lord yang berhak memanipulasi tingkat sihir!');
        const targetUser = message.mentions.users.first();
        const newLevel = parseInt(args[2]);

        if (!targetUser || isNaN(newLevel)) return message.reply('🔮 **Format Salah!** Gunakan: `!setlevel @User <angka_level>`');
        if (targetUser.id === OWNER_ID) return message.reply('👑 Level Lord sudah dikunci permanen di puncak tertinggi!');

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

    if (command === '!levelup') {
        if (userId !== OWNER_ID) return message.reply('❌ Perintah ini khusus untuk Lord of Magic!');
        const testEmbed = new EmbedBuilder()
            .setColor('#25a5cf')
            .setTitle('✨ Hogwarts Academy Level Up!')
            .setDescription(`Selamat! ${message.author} telah naik level! 🎓`)
            .setTimestamp();

        await levelUpChannel.send({ embeds: [testEmbed] });
        return; 
    }

    // B. GENERAL MAGICAL COMMANDS
    if (command === '!profile') {
        const targetUser = message.mentions.users.first() || message.author;
        const targetMember = message.guild.members.cache.get(targetUser.id);
        
        let db = getDbData();
        
        let userLevel, userXp, xpNeeded, wizardTitle, pointsContributed;

        // JIKA OWNER: Kunci Level 9999, tapi kalkulasi batas XP-nya pakai rumus asli yang benar!
        if (targetUser.id === OWNER_ID) {
            userLevel = 9999;
            userXp = 100; // Contoh stat awal exp kamu di lvl 9999
            xpNeeded = getXpNeededForNextLevel(userLevel); // Ini akan menghasilkan angka jutaan asli sesuai level
            wizardTitle = 'Lord of magic';
            pointsContributed = db.users[OWNER_ID] ? db.users[OWNER_ID].pointsContributed : 0;
        } else {
            // Jika member lain
            const userData = db.users[targetUser.id] || { xp: 0, level: 1, pointsContributed: 0 };
            userLevel = userData.level;
            userXp = userData.xp;
            xpNeeded = getXpNeededForNextLevel(userLevel);
            wizardTitle = getWizardTitle(userLevel, targetUser.id);
            pointsContributed = userData.pointsContributed;
        }
        
        const targetHouse = houses.find(h => targetMember.roles.cache.has(h.id));
        const houseName = targetHouse ? `${targetHouse.emoji} ${targetHouse.name}` : 'Belum Masuk Asrama';

        // PANJANG BAR PROGRES: Ditambah jadi 32 balok agar penuh ujung-ke-ujung kotak
        const totalBars = 32;
        const percentage = Math.min(userXp / xpNeeded, 1);
        const filledBars = Math.round(percentage * totalBars);
        const emptyBars = totalBars - filledBars;
        const progressBarText = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

        const profileDisplay = 
`╔══════════════════════════════════════════╗
║              WIZARD PROFILE              ║
╠══════════════════════════════════════════╣
  Nama          :  ${targetUser.username}
  Title         :  ${wizardTitle}
  Asrama        :  ${houseName}
  Level         :  ${userLevel}
  Point Asrama  :  ${pointsContributed.toLocaleString()} Poin
╠══════════════════════════════════════════╣
  BAR PROGRES NAIK LEVEL:
  [${progressBarText}]
  ${userXp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP
╚══════════════════════════════════════════╝`;

        await message.channel.send(`\`\`\`text\n${profileDisplay}\n\`\`\``);
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
            .setTimestamp();

        return message.channel.send({ embeds: [lbEmbed] });
    }

    if (command === '!sortinghat') {
        const embed = new EmbedBuilder()
            .setColor('#25a5cf')
            .setTitle('🎩 The Sorting Hat')
            .setDescription('Welcome to **Hogwarts Academy**\n\nSilahkan tekan tombol di bawah dan biarkan Sorting Hat menentukan kelasmu!');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('sorting_hat').setLabel('Mencari Kelas').setEmoji('🎩').setStyle(ButtonStyle.Success)
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        return;
    }

    // C. AUTOMATIC XP SYSTEM (Berjalan aktif tiap kirim chat untuk SEMUA member)
    if (userId !== OWNER_ID && !xpCooldowns.has(userId)) {
        try {
            let db = getDbData();
            if (!db.users[userId]) {
                db.users[userId] = { xp: 0, level: 1, pointsContributed: 0 };
            }

            // Batasi level maksimal member biasa di 1000
            if (db.users[userId].level >= 1000) return;

            // Dapatkan acak 15-25 XP per satu pesan chat
            const xpGained = Math.floor(Math.random() * 11) + 15;
            db.users[userId].xp += xpGained;

            // Jika member sudah punya asrama, chat mereka juga otomatis nyumbang 1 poin ke asramanya
            if (userHouseObj) {
                db.housePoints[userHouseObj.name] += 1;
                db.users[userId].pointsContributed += 1;
            }

            const xpNeeded = getXpNeededForNextLevel(db.users[userId].level);

            // Logika naik level otomatis
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
            
            // Cooldown 60 detik per pesan agar member tidak spam chat demi kejar XP
            xpCooldowns.add(userId);
            setTimeout(() => xpCooldowns.delete(userId), 60000);

        } catch (err) {
            console.error('Masalah saat memproses XP:', err);
        }
    }
});

// INTERACTION HANDLER (Tombol Sorting Hat)
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isButton()) return;
    if (interaction.customId !== 'sorting_hat') return;

    const member = interaction.member;
    const alreadySorted = houses.some(house => member.roles.cache.has(house.id));

    if (alreadySorted) {
        return interaction.reply({ content: '🎩 You have already been sorted into a House!', ephemeral: true });
    }

    const randomHouse = houses[Math.floor(Math.random() * houses.length)];
    await member.roles.add(randomHouse.id);

    await interaction.reply({ content: `🎩 The Sorting Hat has chosen...\n\n${randomHouse.emoji} ${randomHouse.name}!`, ephemeral: true });
});

client.login(process.env.DISCORD_TOKEN);