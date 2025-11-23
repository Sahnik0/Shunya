import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import codeGenRouter from './routes/codeGen.js';
import sandboxErrorFixRouter from './routes/sandboxErrorFix.js';
import chatRouter from './routes/chat.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: 'shunya'
    });
    console.log('✅ MongoDB Connected Successfully to database: shunya');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

connectDB();

// User Settings Schema
const userSettingsSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  apiSettings: {
    provider: {
      type: String,
      required: true,
      enum: ['openai', 'gemini', 'groq']
    },
    model: {
      type: String,
      required: true
    },
    apiKey: {
      type: String,
      required: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const UserSettings = mongoose.model('UserSettings', userSettingsSchema);

// API Routes
app.use('/api/codegen', codeGenRouter);
app.use('/api/sandbox', sandboxErrorFixRouter);
app.use('/api/chat', chatRouter);

// Save or update user settings
app.post('/api/settings', async (req, res) => {
  try {
    const { userId, apiSettings } = req.body;

    if (!userId || !apiSettings) {
      return res.status(400).json({ error: 'userId and apiSettings are required' });
    }

    const { provider, model, apiKey } = apiSettings;

    if (!provider || !model || !apiKey) {
      return res.status(400).json({ error: 'provider, model, and apiKey are required' });
    }

    const settings = await UserSettings.findOneAndUpdate(
      { userId },
      {
        userId,
        apiSettings: { provider, model, apiKey },
        updatedAt: Date.now()
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Settings saved successfully',
      data: {
        userId: settings.userId,
        apiSettings: {
          provider: settings.apiSettings.provider,
          model: settings.apiSettings.model
        }
      }
    });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Get user settings
app.get('/api/settings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const settings = await UserSettings.findOne({ userId });

    if (!settings) {
      return res.status(404).json({ error: 'Settings not found' });
    }

    res.json({
      success: true,
      data: {
        userId: settings.userId,
        apiSettings: settings.apiSettings
      }
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
