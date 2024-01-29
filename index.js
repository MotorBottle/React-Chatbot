const express = require('express');
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require('mongoose');
const OpenAI = require("openai");
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// ChatSession Schema
const chatSessionSchema = new mongoose.Schema({
  title: { type: String, default: 'New Chat' },
  category: { type: String, default: 'Instant Chat' },
  createdAt: { type: Date, default: Date.now },
  messages: [{ role: String, content: String }],
});

const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

const app = express();
app.use(bodyParser.json());
app.use(cors());
const port = 3080;

// Fetch Sessions
app.get('/sessions', async (req, res) => {
  try {
    const chatSessions = await ChatSession.find({}, 'title _id createdAt').sort({ createdAt: -1 });
    res.json(chatSessions);
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    res.status(500).send('Error fetching chat sessions');
  }
});

// Create New Session
app.post('/new-session', async (req, res) => {
  const { title, category } = req.body;
  const newSession = new ChatSession({ title, category });
  await newSession.save();
  res.json({ id: newSession._id, title: newSession.title, category: newSession.category, createdAt: newSession.createdAt });
});

// Post Message
app.post('/message', async (req, res) => {
  console.log('Received request:', req.body);
  const { sessionId, message } = req.body;

  if (!sessionId || !message) {
    return res.status(400).send('Session ID and message are required.');
  }

  try {
    const session = await ChatSession.findById(sessionId);
    if (!session) return res.status(404).send('Session not found');

    const messages = [...session.messages, { role: "user", content: message }];

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    });

    const botReply = response.choices[0].message.content;
    messages.push({ role: "assistant", content: botReply });

    session.messages = messages;
    await session.save();

    res.json({ reply: botReply, sessionId: session._id });
  } catch (error) {
    console.error('Error with OpenAI API or database:', error);
    res.status(500).send('Error processing request');
  }
});

// Fetch Specific Session
app.get('/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  try {
    const session = await ChatSession.findById(sessionId);
    if (!session) return res.status(404).send('Session not found');

    res.json(session);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).send('Error fetching session');
  }
});

// Clear Chat History
app.post('/clear', async (req, res) => {
  const { sessionId } = req.body;

  try {
    await ChatSession.findByIdAndUpdate(sessionId, { $set: { messages: [] } });
    res.send({ message: "Chat history cleared." });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).send('Error clearing chat history');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});