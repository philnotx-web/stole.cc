/**
 * stole.cc Discord Bot
 * ─────────────────────────────────────────────────────────────────
 * Commands:
 *   /sotd <spotify_url>          — set today's Song of the Day
 *   /sotd clear                  — clear the current SOTD
 *   /motd <quote> [author]       — set today's Motto of the Day
 *   /motd clear                  — clear the current MOTD
 *   /today                       — show what's currently set
 *
 * Setup:
 *   1. npm install discord.js @supabase/supabase-js
 *   2. node bot.js
 *
 * Hosting (free): Railway.app or Render.com
 *   → add bot.js + package.json, set env vars, deploy
 * ─────────────────────────────────────────────────────────────────
 */

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

/* ── CONFIG ──────────────────────────────────────────────────────
   Set these as environment variables on your hosting platform,
   or replace the strings directly for local testing.
────────────────────────────────────────────────────────────────── */
const CONFIG = {
  DISCORD_TOKEN:   process.env.DISCORD_TOKEN   || 'MTUxMzk4NTYyNTg5OTEzOTI2Mg.GGxPAl.MjiWkPvKTePuff4Nqcbi6ym0BBZ6lMbJDZf4Zw',
  CLIENT_ID:       process.env.CLIENT_ID       || '1513985625898913926',   // fill in after creating app
  GUILD_ID:        process.env.GUILD_ID        || '',                       // optional: your server ID for instant registration
  CHANNEL_ID:      process.env.CHANNEL_ID      || '1513985385141764208',
  SUPABASE_URL:    process.env.SUPABASE_URL    || 'https://wjooxweijejumgvutdvo.supabase.co',
  SUPABASE_SECRET: process.env.SUPABASE_SECRET || 'sb_secret_9-V6Cm9gZgwPCxmrSm_j7g_hcIo8LY8',
};

/* ── SUPABASE CLIENT ─────────────────────────────────────────── */
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SECRET);

async function dbGet(type) {
  const { data, error } = await supabase
    .from('daily_content')
    .select('*')
    .eq('type', type)
    .limit(1)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

async function dbUpdate(type, content, source, date) {
  const { error } = await supabase
    .from('daily_content')
    .update({ content, source: source || null, date, updated_at: new Date().toISOString() })
    .eq('type', type);
  if (error) throw error;
}

/* ── HELPERS ─────────────────────────────────────────────────── */
function today() {
  return new Date().toISOString().split('T')[0];
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}.${m}.${y}`;
}

function extractSpotifyId(url) {
  const m = (url || '').match(/track\/([A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

function isAllowedChannel(interaction) {
  return interaction.channelId === CONFIG.CHANNEL_ID;
}

/* ── SLASH COMMAND DEFINITIONS ───────────────────────────────── */
const commands = [
  new SlashCommandBuilder()
    .setName('sotd')
    .setDescription('Set or clear the Song of the Day')
    .addStringOption(opt =>
      opt.setName('url')
        .setDescription('Spotify track URL — or type "clear" to remove')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('date')
        .setDescription('Date (YYYY-MM-DD) — defaults to today')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('motd')
    .setDescription('Set or clear the Motto of the Day')
    .addStringOption(opt =>
      opt.setName('quote')
        .setDescription('The motto or quote — or type "clear" to remove')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('author')
        .setDescription('Source / author (optional)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('date')
        .setDescription('Date (YYYY-MM-DD) — defaults to today')
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName('today')
    .setDescription('Show what\'s currently set for SOTD and MOTD'),
];

/* ── REGISTER COMMANDS ───────────────────────────────────────── */
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(CONFIG.DISCORD_TOKEN);
  try {
    console.log('Registering slash commands…');
    if (CONFIG.GUILD_ID) {
      /* Guild commands update instantly (good for testing) */
      await rest.put(
        Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
        { body: commands.map(c => c.toJSON()) }
      );
      console.log(`Commands registered to guild ${CONFIG.GUILD_ID}`);
    } else {
      /* Global commands take up to 1h to propagate */
      await rest.put(
        Routes.applicationCommands(CONFIG.CLIENT_ID),
        { body: commands.map(c => c.toJSON()) }
      );
      console.log('Global commands registered.');
    }
  } catch (err) {
    console.error('Command registration failed:', err);
  }
}

/* ── DISCORD CLIENT ──────────────────────────────────────────── */
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  /* Only respond in the designated channel */
  if (!isAllowedChannel(interaction)) {
    await interaction.reply({
      content: `⚠️ Use this command in <#${CONFIG.CHANNEL_ID}>.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    switch (interaction.commandName) {

      /* ── /sotd ─────────────────────────────────────────── */
      case 'sotd': {
        const url  = interaction.options.getString('url').trim();
        const date = interaction.options.getString('date') || today();

        if (url.toLowerCase() === 'clear') {
          await dbUpdate('sotd', '', null, date);
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(0x5ee7df)
              .setTitle('🎵 SOTD cleared')
              .setDescription('Song of the Day has been removed.')
              .setTimestamp()
            ]
          });
          break;
        }

        const trackId = extractSpotifyId(url);
        if (!trackId) {
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(0xff4444)
              .setTitle('❌ Invalid URL')
              .setDescription('That doesn\'t look like a valid Spotify track link.\nExample: `https://open.spotify.com/track/...`')
            ]
          });
          break;
        }

        await dbUpdate('sotd', url, null, date);

        await interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0x5ee7df)
            .setTitle('🎵 Song of the Day set!')
            .setDescription(`**Date:** ${formatDate(date)}\n**Link:** [Open on Spotify](${url})`)
            .setImage(`https://i.scdn.co/image/`)   // Spotify doesn't allow direct embeds in Discord
            .setFooter({ text: 'stole.cc — Song of the Day' })
            .setTimestamp()
          ]
        });
        break;
      }

      /* ── /motd ─────────────────────────────────────────── */
      case 'motd': {
        const quote  = interaction.options.getString('quote').trim();
        const author = interaction.options.getString('author')?.trim() || null;
        const date   = interaction.options.getString('date') || today();

        if (quote.toLowerCase() === 'clear') {
          await dbUpdate('motd', '', null, date);
          await interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(0xb490f5)
              .setTitle('💬 MOTD cleared')
              .setDescription('Motto of the Day has been removed.')
              .setTimestamp()
            ]
          });
          break;
        }

        await dbUpdate('motd', quote, author, date);

        const embed = new EmbedBuilder()
          .setColor(0xb490f5)
          .setTitle('💬 Motto of the Day set!')
          .setDescription(`> ${quote}`)
          .addFields({ name: 'Date', value: formatDate(date), inline: true })
          .setFooter({ text: 'stole.cc — Motto of the Day' })
          .setTimestamp();

        if (author) embed.addFields({ name: 'Author', value: author, inline: true });

        await interaction.editReply({ embeds: [embed] });
        break;
      }

      /* ── /today ────────────────────────────────────────── */
      case 'today': {
        const [sotd, motd] = await Promise.all([dbGet('sotd'), dbGet('motd')]);

        const embed = new EmbedBuilder()
          .setColor(0xffd27f)
          .setTitle('📅 Today\'s Content — stole.cc')
          .setTimestamp();

        /* SOTD */
        if (sotd?.content) {
          embed.addFields({
            name: '🎵 Song of the Day',
            value: `[Open on Spotify](${sotd.content})\n_${formatDate(sotd.date)}_`,
          });
        } else {
          embed.addFields({ name: '🎵 Song of the Day', value: '_Not set_' });
        }

        /* MOTD */
        if (motd?.content) {
          const motdValue = `> ${motd.content}${motd.source ? `\n— ${motd.source}` : ''}\n_${formatDate(motd.date)}_`;
          embed.addFields({ name: '💬 Motto of the Day', value: motdValue });
        } else {
          embed.addFields({ name: '💬 Motto of the Day', value: '_Not set_' });
        }

        await interaction.editReply({ embeds: [embed] });
        break;
      }
    }
  } catch (err) {
    console.error(`Error handling /${interaction.commandName}:`, err);
    const errMsg = new EmbedBuilder()
      .setColor(0xff4444)
      .setTitle('❌ Something went wrong')
      .setDescription(`\`\`\`${err.message}\`\`\``);
    await interaction.editReply({ embeds: [errMsg] }).catch(() => {});
  }
});

client.login(CONFIG.DISCORD_TOKEN);
