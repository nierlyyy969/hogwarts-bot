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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates // Untuk mendeteksi durasi Voice Channel
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

// Rumus Kelipatan Linear Sesuai Hitungan Target Level 1000
function getXpNeededForNextLevel(level) {
    if (level >= 9999) return 49995; // Limit display bar untuk owner
    return level * 5; 
}

// Penentu Gelar Berdasarkan Level
function getWizardTitle(level, userId) {
    if (userId === OWNER_ID) return 'Lord of Magic';
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

    // LOOP INTERVAL VOICE CHANNEL XP (Berjalan otomatis setiap 1 menit)
    setInterval(async () => {
        try {
            let db = getDbData();
            const guilds = client.guilds.cache;

            for (const [guildId, guild] of guilds) {
                guild.voiceStates.cache.forEach(async (voiceState) => {
                    const userId = voiceState.id;

                    // Validasi: Harus berada di VC, bukan bot, dan bukan Owner
                    if (voiceState.channelId && !voiceState.member.user.bot && userId !== OWNER_ID) {
                        
                        if (!db.users[userId]) {
                            db.users[userId] = { xp: 0, level: 1, pointsContributed: 0 };
                        }

                        // Maksimal level member adalah 1000
                        if (db.users[userId].level >= 1000) return;

                        // Tambahkan 12 XP per menit
                        db.users[userId].xp += 12;

                        // Tambahkan poin ke asrama jika sudah bergabung (1 poin per menit di VC)
                        const userHouseObj = houses.find(h => voiceState.member.roles.cache.has(h.id));
                        if (userHouseObj) {
                            db.housePoints[userHouseObj.name] += 1;
                            db.users[userId].pointsContributed += 1;
                        }

                        // Cek kelayakan naik level
                        let xpNeeded = getXpNeededForNextLevel(db.users[userId].level);
                        let levelUpOccurred = false;

                        while (db.users[userId].xp >= xpNeeded) {
                            db.users[userId].xp -= xpNeeded;
                            db.users[userId].level += 1;
                            xpNeeded = getXpNeededForNextLevel(db.users[userId].level);
                            levelUpOccurred = true;

                            if (db.users[userId].level >= 1000) {
                                db.users[userId].level = 1000;
                                db.users[userId].xp = 0;
                                break;
                            }
                        }

                        if (levelUpOccurred) {
                            const newTitle = getWizardTitle(db.users[userId].level, userId);
                            const levelUpChannel = guild.channels.cache.get(LEVEL_UP_CHANNEL_ID);
                            
                            if (levelUpChannel) {
                                const levelUpEmbed = new EmbedBuilder()
                                    .setColor('#25a5cf') 
                                    .setTitle('✨ Hogwarts Academy Level Up!')
                                    .setDescription(`Selamat! <@${userId}> naik ke **Level ${db.users[userId].level}** lewat kekuatan Voice Channel dan kini bergelar **${newTitle}**! 🎓`)
                                    .setTimestamp();

                                levelUpChannel.send({ embeds: [levelUpEmbed] }).catch(console.error);
                            }
                        }
                    }
                });
            }
            saveDbData(db);
        } catch (err) {
            console.error('Masalah saat memproses Voice XP Loop:', err);
        }
    }, 60000); 
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

        db.users[targetUser.id].level = Math.min(newLevel, 1000); // Kunci maks 1000 untuk member biasa
        db.users[targetUser.id].xp = 0; 
        saveDbData(db);

        message.reply(`✅ Berhasil mengubah tingkat sihir ${targetUser} menjadi **Level ${db.users[targetUser.id].level}**!`);
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

        if (targetUser.id === OWNER_ID) {
            userLevel = 9999;
            userXp = 0; 
            xpNeeded = getXpNeededForNextLevel(userLevel); 
            wizardTitle = 'Lord of Magic';
            pointsContributed = db.users[OWNER_ID] ? db.users[OWNER_ID].pointsContributed : 0;
        } else {
            const userData = db.users[targetUser.id] || { xp: 0, level: 1, pointsContributed: 0 };
            userLevel = userData.level;
            userXp = userData.xp;
            xpNeeded = getXpNeededForNextLevel(userLevel);
            wizardTitle = getWizardTitle(userLevel, targetUser.id);
            pointsContributed = userData.pointsContributed;
        }
        
        const targetHouse = houses.find(h => targetMember.roles.cache.has(h.id));
        const houseName = targetHouse ? `${targetHouse.emoji} ${targetHouse.name}` : 'Belum Masuk Asrama';

        // Total lebar kotak diset 38 karakter agar ramping dan proporsional di HP
        const totalBars = 16;
        const percentage = xpNeeded > 0 ? Math.min(userXp / xpNeeded, 1) : 1;
        const filledBars = Math.round(percentage * totalBars);
        const emptyBars = totalBars - filledBars;
        const progressBarText = '▓'.repeat(filledBars) + '░'.repeat(emptyBars);

        const profileDisplay = 
`┌──────────────────────────────────────┐
           ✨ WIZARD PROFILE ✨         
├──────────────────────────────────────┤
  Nama        :  ${targetUser.username}
  Title       :  ${wizardTitle}
  Asrama      :  ${houseName}
  Level       :  ${userLevel}
  Point       :  ${pointsContributed.toLocaleString()} Poin
├──────────────────────────────────────┤
  PROGRES NAIK LEVEL:
  [${progressBarText}]
  ⚡ ${userXp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP
└──────────────────────────────────────┘`;

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
        // DIBATASI: Sorting Hat kini hanya bisa dipanggil oleh Lord of Magic (Owner)
        if (userId !== OWNER_ID) {
            return message.reply('❌ Hanya Lord of Magic yang berhak memanggil The Sorting Hat!');
        }

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

    // C. AUTOMATIC XP SYSTEM (Chat Text - 15 XP Flat)
    if (userId !== OWNER_ID && !xpCooldowns.has(userId)) {
        try {
            let db = getDbData();
            if (!db.users[userId]) {
                db.users[userId] = { xp: 0, level: 1, pointsContributed: 0 };
            }

            if (db.users[userId].level >= 1000) return;

            // Penambahan 15 EXP Flat per chat valid
            const xpGained = 15;
            db.users[userId].xp += xpGained;

            if (userHouseObj) {
                db.housePoints[userHouseObj.name] += 1;
                db.users[userId].pointsContributed += 1;
            }

            let xpNeeded = getXpNeededForNextLevel(db.users[userId].level);
            let levelUpOccurred = false;

            // Logika loop naik level kelipatan 5
            while (db.users[userId].xp >= xpNeeded) {
                db.users[userId].xp -= xpNeeded; 
                db.users[userId].level += 1; 
                xpNeeded = getXpNeededForNextLevel(db.users[userId].level);
                levelUpOccurred = true;

                if (db.users[userId].level >= 1000) {
                    db.users[userId].level = 1000;
                    db.users[userId].xp = 0;
                    break;
                }
            }

            if (levelUpOccurred) {
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
            setTimeout(() => xpCooldowns.delete(userId), 60000); // Cooldown 1 menit agar tidak spam chat

        } catch (err) {
            console.error('Masalah saat memproses XP Chat:', err);
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