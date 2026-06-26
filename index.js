require('dotenv').config();
const mongoose = require('mongoose');

const {
    Client,
    GatewayIntentBits,
    Events,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');

// Mengambil model User yang ada di folder /models
const User = require('./models/User'); 

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// ==========================================
// PENGATURAN HOGWARTS & DATABASE
// ==========================================
const OWNER_ID = '1180180812327559310'; 
const LEVEL_UP_CHANNEL_ID = '1475801714425860272'; 

const HOUSES_DATA = [
    { id: '1475605712938864796', name: 'Gryffindor', emoji: '🦁', command: 'gryffindor' },
    { id: '1475786100210401413', name: 'Slytherin', emoji: '🐍', command: 'slytherin' },
    { id: '1475786808167235604', name: 'Ravenclaw', emoji: '🦅', command: 'ravenclaw' },
    { id: '1475787032759631965', name: 'Hufflepuff', emoji: '🦡', command: 'hufflepuff' }
];

// Inisialisasi Poin Asrama Sementara di Memori
let housePointsCache = {
    'Gryffindor': 0,
    'Slytherin': 0,
    'Ravenclaw': 0,
    'Hufflepuff': 0
};

function getXpNeededForNextLevel(level) {
    if (level >= 9999) return 49995;
    return level * 5; 
}

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

// ==========================================
// KONEKSI DATABASE & BOT READY
// ==========================================
mongoose.connect(process.env.MONGO_URL || process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('🔗 Connected to MongoDB Database successfully!');
    client.login(process.env.DISCORD_TOKEN);
}).catch(err => {
    console.error('❌ Failed to connect to MongoDB:', err);
});

client.once(Events.ClientReady, () => {
    console.log(`✨ Logged in as ${client.user.tag} — System online! ✨`);

    // Voice XP Loop Anti Reset
    setInterval(async () => {
        try {
            const guilds = client.guilds.cache;
            for (const [guildId, guild] of guilds) {
                guild.voiceStates.cache.forEach(async (voiceState) => {
                    const userId = voiceState.id;

                    if (voiceState.channelId && !voiceState.member.user.bot && userId !== OWNER_ID) {
                        let userDoc = await User.findOne({ userId, guildId: guild.id });
                        if (!userDoc) {
                            userDoc = new User({ userId, guildId: guild.id, xp: 0, level: 1 });
                        }

                        if (userDoc.level >= 1000) return;

                        userDoc.xp += 12;

                        const userHouseObj = HOUSES_DATA.find(h => voiceState.member.roles.cache.has(h.id));
                        if (userHouseObj) {
                            housePointsCache[userHouseObj.name] = (housePointsCache[userHouseObj.name] || 0) + 1;
                        }

                        let xpNeeded = getXpNeededForNextLevel(userDoc.level);
                        let levelUpOccurred = false;
                        let reachedLevelCheckpoint = false;

                        while (userDoc.xp >= xpNeeded) {
                            userDoc.xp -= xpNeeded;
                            userDoc.level += 1;
                            xpNeeded = getXpNeededForNextLevel(userDoc.level);
                            levelUpOccurred = true;

                            if (userDoc.level % 5 === 0) {
                                reachedLevelCheckpoint = true;
                            }

                            if (userDoc.level >= 1000) {
                                userDoc.level = 1000;
                                userDoc.xp = 0;
                                break;
                            }
                        }

                        await userDoc.save();

                        if (levelUpOccurred && reachedLevelCheckpoint) {
                            const newTitle = getWizardTitle(userDoc.level, userId);
                            const levelUpChannel = guild.channels.cache.get(LEVEL_UP_CHANNEL_ID);
                            
                            if (levelUpChannel) {
                                const levelUpEmbed = new EmbedBuilder()
                                    .setColor('#25a5cf') 
                                    .setTitle('✨ Hogwarts Academy Milestone!')
                                    .setDescription(`Selamat! <@${userId}> telah mencapai **Level ${userDoc.level}** dan kini bergelar **${newTitle}**! 🎓 Pencapaian yang luar biasa!`)
                                    .setTimestamp();

                                levelUpChannel.send({ embeds: [levelUpEmbed] }).catch(console.error);
                            }
                        }
                    }
                });
            }
        } catch (err) {
            console.error('Masalah saat memproses Voice XP Loop:', err);
        }
    }, 60000); 
});

client.on(Events.GuildMemberRemove, async (member) => {
    try {
        await User.findOneAndDelete({ userId: member.id, guildId: member.guild.id });
        console.log(`🧹 Data level dari ${member.user.username} di-reset otomatis karena keluar server.`);
    } catch (err) {
        console.error('Gagal menghapus data member keluar:', err);
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
    const userHouseObj = HOUSES_DATA.find(h => message.member.roles.cache.has(h.id));

    const isOwner = userId === OWNER_ID;
    const isSorted = !!userHouseObj;

    // A. ADMIN COMMANDS (Khusus Lord / Owner Server)
    if (command === '!setlevel') {
        if (!isOwner) return message.reply('❌ Hanya Lord yang berhak memanipulasi tingkat sihir!');
        const targetUser = message.mentions.users.first();
        const newLevel = parseInt(args[2]);

        if (!targetUser || isNaN(newLevel)) return message.reply('🔮 **Format Salah!** Gunakan: `!setlevel @User <angka_level>`');
        if (targetUser.id === OWNER_ID) return message.reply('👑 Level Lord sudah dikunci permanen di puncak tertinggi!');

        let userDoc = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });
        if (!userDoc) {
            userDoc = new User({ userId: targetUser.id, guildId: message.guild.id, xp: 0, level: 1 });
        }

        userDoc.level = Math.min(newLevel, 1000); 
        userDoc.xp = 0; 
        await userDoc.save();

        message.reply(`✅ Berhasil mengubah tingkat sihir ${targetUser} menjadi **Level ${userDoc.level}**!`);
        return;
    }

    if (command === '!givepoint') {
        if (!isOwner) return message.reply('❌ Hanya Lord yang bisa memberikan berkah poin asrama!');
        const targetMember = message.mentions.members.first();
        const points = parseInt(args[2]);

        if (!targetMember || isNaN(points)) return message.reply('🔮 **Format Salah!** Gunakan: `!givepoint @User <jumlah_poin>`');

        const targetHouse = HOUSES_DATA.find(h => targetMember.roles.cache.has(h.id));
        if (!targetHouse) return message.reply('❌ Penyihir tersebut belum bergabung dengan asrama Hogwarts mana pun!');

        housePointsCacheUpdate(targetHouse.name, points);

        return message.reply(`🏆 **+${points.toLocaleString()} Poin** telah dianugerahkan ke asrama **${targetHouse.emoji} ${targetHouse.name}** berkat prestasi ${targetMember}!`);
    }

    if (command === '!levelup') {
        if (!isOwner) return message.reply('❌ Perintah ini khusus untuk Lord of Magic!');
        const testEmbed = new EmbedBuilder()
            .setColor('#25a5cf')
            .setTitle('✨ Hogwarts Academy Level Up!')
            .setDescription(`Selamat! ${message.author} telah naik level! 🎓`)
            .setTimestamp();

        await levelUpChannel.send({ embeds: [testEmbed] });
        return; 
    }

    if (command === '!sortinghat') {
        if (!isOwner) return message.reply('❌ Hanya Lord of Magic yang berhak memanggil The Sorting Hat!');

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

    // Blokir command umum jika belum mendapat role kelas asrama
    if (!isSorted && !isOwner) {
        if (['!profile', '!leaderboard', '!roster', '!rosterslytherin', '!rostergryffindor', '!rosterravenclaw', '!rosterhufflepuff'].some(cmd => command.startsWith(cmd))) {
            return message.reply('❌ **Akses Ditolak!** Perintah ini hanya boleh digunakan oleh murid yang sudah memiliki Role Asrama / Kelas (Lewat The Sorting Hat). Silakan hubungi Lord of Magic!');
        }
    }

    // B. GENERAL MAGICAL COMMANDS
    if (command === '!profile') {
        // AMAN: Memastikan guild menghandel cache member secara penuh
        await message.guild.members.fetch();
        const targetUser = message.mentions.users.first() || message.author;
        const targetMember = message.guild.members.cache.get(targetUser.id);
        
        if (!targetMember) {
            return message.reply('❌ Terjadi kesalahan: Penyihir tidak ditemukan di dalam server ini.');
        }

        let userLevel, userXp, xpNeeded, wizardTitle;
        let pointsContributed = 0; 

        if (targetUser.id === OWNER_ID) {
            userLevel = 9999;
            userXp = 0; 
            xpNeeded = getXpNeededForNextLevel(userLevel); 
            wizardTitle = 'Lord of Magic';
        } else {
            let userDoc = await User.findOne({ userId: targetUser.id, guildId: message.guild.id });
            if (!userDoc) {
                userDoc = new User({ userId: targetUser.id, guildId: message.guild.id, xp: 0, level: 1 });
                await userDoc.save();
            }
            
            userLevel = userDoc.level;
            userXp = userDoc.xp;
            xpNeeded = getXpNeededForNextLevel(userLevel);
            wizardTitle = getWizardTitle(userLevel, targetUser.id);
        }
        
        const targetHouse = HOUSES_DATA.find(h => targetMember.roles.cache.has(h.id));
        const houseName = targetHouse ? `${targetHouse.emoji} ${targetHouse.name}` : 'Belum Masuk Asrama';

        const progressPercentage = targetUser.id === OWNER_ID ? 100 : Math.min(Math.floor((userXp / xpNeeded) * 100), 100);
        
        const totalBlocks = 15;
        const filledBlocks = Math.floor((progressPercentage / 100) * totalBlocks);
        const emptyBlocks = totalBlocks - filledBlocks;
        const visualBar = '▓'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

        const profileEmbed = new EmbedBuilder()
            .setColor('#25a5cf')
            .setAuthor({ 
                name: `✨ WIZARD PROFILE — ${targetUser.username.toUpperCase()} ✨`, 
                iconURL: targetUser.displayAvatarURL({ dynamic: true }) 
            })
            .setDescription('Selamat datang di **Hogwarts Academy Magic System** 🏰✨')
            .addFields(
                { name: '🧙‍♂️ Nama Penyihir', value: `\`${targetUser.username}\``, inline: true },
                { name: '🏷️ Gelar Sihir', value: `\`${wizardTitle}\``, inline: true },
                { name: '🏰 Asrama Hogwarts', value: `${houseName}`, inline: true },
                { name: '⭐ Level Saat Ini', value: `\`${userLevel}\``, inline: true },
                { name: '🏆 Poin Kontribusi', value: `\`${pointsContributed.toLocaleString()} Poin\``, inline: true },
                { name: '\u200B', value: '\u200B' }, 
                { 
                    name: `📈 Progress Menuju Level Berikutnya (${progressPercentage}%)`, 
                    value: `\`[${visualBar}]\`\n⚡ **${userXp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP**` 
                }
            )
            .setTimestamp()
            .setFooter({ text: 'Hogwarts Academy Magic System', iconURL: client.user.displayAvatarURL() });

        await message.channel.send({ embeds: [profileEmbed] });
        return;
    }

    if (command === '!leaderboard') {
        const sortedHouses = Object.entries(housePointsCache).sort((a, b) => b[1] - a[1]);

        const lbEmbed = new EmbedBuilder()
            .setColor('#25a5cf') 
            .setTitle('🏆 House Cup Tournament - Leaderboard')
            .setDescription('Klasemen asrama Hogwarts saat ini:\n\n' + sortedHouses.map((house, index) => {
                const houseMeta = HOUSES_DATA.find(h => h.name === house[0]);
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📜';
                return `${medal} **Rank ${index + 1}**: ${houseMeta.emoji} **${house[0]}** — \`${house[1].toLocaleString()} Poin\``;
            }).join('\n'))
            .setTimestamp();

        return message.channel.send({ embeds: [lbEmbed] });
    }

    // FITUR TAMBAHAN: Roster Anggota Asrama (Hanya Display Name & Emotikon Sihir rapi)
    const targetHouseRoster = HOUSES_DATA.find(h => `!roster${h.command}` === command);
    if (targetHouseRoster) {
        await message.guild.members.fetch(); 

        const membersInHouse = message.guild.members.cache.filter(member => 
            member.roles.cache.has(targetHouseRoster.id) && !member.user.bot
        );

        let rosterDescription = `📜 **Daftar Penyihir Asrama ${targetHouseRoster.emoji} ${targetHouseRoster.name}**:\n\n`;
        
        if (membersInHouse.size === 0) {
            rosterDescription += '*(Belum ada penyihir yang masuk asrama ini)*';
        } else {
            const listDisplay = membersInHouse.map(member => {
                const displayName = member.displayName;
                return `✨ 🪄 **${displayName}** 🔮`;
            }).join('\n');
            
            rosterDescription += listDisplay;
        }

        const rosterEmbed = new EmbedBuilder()
            .setColor('#25a5cf')
            .setTitle(`✨ ${targetHouseRoster.emoji} Roster Anggota ${targetHouseRoster.name} ✨`)
            .setDescription(rosterDescription)
            .setTimestamp()
            .setFooter({ text: `Total Anggota: ${membersInHouse.size} Penyihir`, iconURL: client.user.displayAvatarURL() });

        await message.channel.send({ embeds: [rosterEmbed] });
        return;
    }

    // C. AUTOMATIC XP SYSTEM (Chat Text - 15 XP Flat)
    if (userId !== OWNER_ID && !xpCooldowns.has(userId)) {
        try {
            let userDoc = await User.findOne({ userId, guildId: message.guild.id });
            if (!userDoc) {
                userDoc = new User({ userId, guildId: message.guild.id, xp: 0, level: 1 });
            }

            if (userDoc.level >= 1000) return;

            const xpGained = 15;
            userDoc.xp += xpGained;

            if (userHouseObj) {
                houseCacheUpdate(userHouseObj.name, 1);
            }

            let xpNeeded = getXpNeededForNextLevel(userDoc.level);
            let levelUpOccurred = false;
            let reachedLevelCheckpoint = false;

            while (userDoc.xp >= xpNeeded) {
                userDoc.xp -= xpNeeded; 
                userDoc.level += 1; 
                xpNeeded = getXpNeededForNextLevel(userDoc.level);
                levelUpOccurred = true;

                if (userDoc.level % 5 === 0) {
                    reachedLevelCheckpoint = true;
                }

                if (userDoc.level >= 1000) {
                    userDoc.level = 1000;
                    userDoc.xp = 0;
                    break;
                }
            }

            if (levelUpOccurred && reachedLevelCheckpoint) {
                const newTitle = getWizardTitle(userDoc.level, userId);
                const levelUpEmbed = new EmbedBuilder()
                    .setColor('#25a5cf') 
                    .setTitle('✨ Hogwarts Academy Milestone!')
                    .setDescription(`Selamat! <@${userId}> telah mencapai **Level ${userDoc.level}** dan kini bergelar **${newTitle}**! 🎓 Pencapaian yang luar biasa!`)
                    .setTimestamp();

                await levelUpChannel.send({ embeds: [levelUpEmbed] });
            }

            await userDoc.save();
            
            xpCooldowns.add(userId);
            setTimeout(() => xpCooldowns.delete(userId), 60000);

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
    const alreadySorted = HOUSES_DATA.some(house => member.roles.cache.has(house.id));

    if (alreadySorted) {
        return interaction.reply({ content: '🎩 You have already been sorted into a House!', ephemeral: true });
    }

    const randomHouse = HOUSES_DATA[Math.floor(Math.random() * HOUSES_DATA.length)];
    await member.roles.add(randomHouse.id);

    await interaction.reply({ content: `🎩 The Sorting Hat has chosen...\n\n${randomHouse.emoji} ${randomHouse.name}!`, ephemeral: true });
});

function housePointsCacheUpdate(houseName, points) {
    housePointsCache[houseName] = (housePointsCache[houseName] || 0) + points;
}

function houseCacheUpdate(houseName, points) {
    housePointsCache[houseName] = (housePointsCache[houseName] || 0) + points;
}

client.login(process.env.DISCORD_TOKEN);