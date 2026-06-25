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