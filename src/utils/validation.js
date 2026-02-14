import Joi from "joi";
import { replyError } from "./discordOutput.js";

// Common validation schemas
export const schemas = {
  userId: Joi.string().pattern(/^\d{17,19}$/).required(),
  guildId: Joi.string().pattern(/^\d{17,19}$/).required(),
  
  credits: Joi.number().integer().min(1).max(1000000000).required(),
  
  itemId: Joi.string().min(3).max(50).pattern(/^[a-z0-9_]+$/).required(),
  quantity: Joi.number().integer().min(1).max(999).optional(),
  
  pageNumber: Joi.number().integer().min(1).max(1000).optional(),
  
  commandName: Joi.string().min(1).max(32).pattern(/^[a-z0-9_-]+$/).required(),
  
  message: Joi.string().min(1).max(2000).required(),
  
  url: Joi.string().uri().max(2048).optional(),
  
  email: Joi.string().email().max(255).optional(),
  
  agentToken: Joi.string().pattern(/^[A-Za-z0-9._-]{50,100}$/).required(),
};

// Validate Discord command options
export async function validateCommandInput(interaction, schema) {
  const data = {};
  
  // Extract all options from interaction
  for (const [key, value] of Object.entries(schema)) {
    const option = interaction.options.get(key);
    if (option) {
      data[key] = option.value || option.user?.id || option.channel?.id;
    }
  }

  const { error, value } = Joi.object(schema).validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const errors = error.details.map(d => d.message).join(", ");
    await replyError(
      interaction,
      "Invalid Input",
      `Validation failed: ${errors}`,
      true
    );
    return null;
  }

  return value;
}

// Sanitize user input (prevent injection attacks)
export function sanitizeString(input) {
  if (typeof input !== "string") return input;
  
  return input
    .trim()
    .replace(/[<>]/g, "") // Remove potential HTML/XML tags
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
    .substring(0, 2000); // Limit length
}

// Validate and sanitize economy transaction
export function validateTransaction(from, to, amount) {
  const schema = Joi.object({
    from: schemas.userId,
    to: schemas.userId,
    amount: Joi.number().integer().min(1).max(1000000000).required(),
  });

  const { error, value } = schema.validate({ from, to, amount });
  
  if (error) {
    throw new Error(`Transaction validation failed: ${error.message}`);
  }
  
  return value;
}

// Validate item purchase
export function validateItemPurchase(userId, itemId, quantity, price) {
  const schema = Joi.object({
    userId: schemas.userId,
    itemId: schemas.itemId,
    quantity: Joi.number().integer().min(1).max(999).required(),
    price: Joi.number().integer().min(0).max(1000000000).required(),
  });

  const { error, value } = schema.validate({ userId, itemId, quantity, price });
  
  if (error) {
    throw new Error(`Item purchase validation failed: ${error.message}`);
  }
  
  return value;
}

// Validate agent token format (for pool contributions)
export function validateAgentToken(token) {
  const { error } = schemas.agentToken.validate(token);
  
  if (error) {
    throw new Error("Invalid agent token format");
  }
  
  return true;
}

// Comprehensive input sanitization for database queries
export function sanitizeForDatabase(obj) {
  if (typeof obj !== "object" || obj === null) return obj;
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === "object") {
      sanitized[key] = sanitizeForDatabase(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

export default {
  schemas,
  validateCommandInput,
  sanitizeString,
  validateTransaction,
  validateItemPurchase,
  validateAgentToken,
  sanitizeForDatabase,
};
