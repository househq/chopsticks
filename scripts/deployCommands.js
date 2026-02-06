import { REST, Routes } from "discord.js";
import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commandsPath = path.join(process.cwd(), "src", "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

const commands = [];

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  
  try {
    const module = await import(`file://${filePath}`);
    
    const cmd = module.default ?? (module.data && module.execute ? { data: module.data, execute: module.execute } : null);
    
    if (cmd && cmd.data) {
      const json = cmd.data.toJSON();
      commands.push(json);
      console.log(`✅ Loaded command: ${cmd.data.name}`);
    }
  } catch (err) {
    console.error(`❌ Failed to load ${file}:`, err.message);
    console.error("Full error:", err);
  }
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
const CLIENT_ID = process.env.CLIENT_ID;

(async () => {
  try {
    console.log(`📤 Deploying ${commands.length} commands...`);

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );

    console.log("✅ Commands deployed globally");
  } catch (error) {
    console.error("❌ Deployment failed:", error);
  }
})();