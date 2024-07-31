const express = require('express');
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require('mongoose');
require('dotenv').config();
const fetch = require('node-fetch');
// const { default: OpenAI } = require('openai');
const readline = require('readline');

// let APIChannel = "OpenAI";
let APIChannel = "Ollama";

let contextWindowSize = 131072;

/*
// If you're using official api, use this. 
const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// And mod the code for creating chat completions as well

// Example of official API
const response = await openai.chat.completions.create({
  model: currentModel,
  max_tokens: 8000,
  messages: messages.map(m => ({ role: m.role, content: m.content }))
});

// Example of self-host API (current setup)
const response = await requestOpenai('/v1/chat/completions', {
  model: currentModel,
  max_tokens: 8000,
  messages: messages.map(m => ({ role: m.role, content: m.content }))
});
*/

let currentModel = "gpt-3.5-turbo";

// 自定义的 requestOpenai 函数，用于转发请求
async function requestOpenai(endpoint, body) {
  let url;
  let headers;

  if (APIChannel === "OpenAI") {
    url = new URL(endpoint, process.env.OPENAI_API_URL).toString();
    headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    };
  } else if (APIChannel === "Ollama") {
    url = new URL(endpoint, process.env.OLLAMA_API_URL).toString();
    headers = {
      'Content-Type': 'application/json'
    };
  } else {
    throw new Error('Invalid APIChannel specified');
  }

  const options = {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  };

  console.log(`Sending request to ${url} with options:`, options);

  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type');

  if (!response.ok) {
    const responseText = await response.text();
    console.error('OpenAI API request failed with status:', response.status);
    console.error('Response:', responseText);
    throw new Error(`OpenAI API request failed: ${response.statusText}`);
  }

  if (contentType.includes('application/json')) {
    return response.json();
  }

  if (contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson')) {
    return response.body;
  }

  throw new Error(`Expected application/json or text/event-stream but got ${contentType}`);
}

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// ChatSession Schema
const chatSessionSchema = new mongoose.Schema({
  title: { type: String, default: 'New Chat' },
  category: { type: String, default: 'Instant Chat' },
  updatedAt: { type: Date, default: Date.now },
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
    const chatSessions = await ChatSession.find({}, 'title _id updatedAt').sort({ updatedAt: -1 });
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
  res.json({ id: newSession._id, title: newSession.title, category: newSession.category, updatedAt: newSession.updatedAt });
});

// Auto create title after 1st rd of conversation
app.post('/auto-title', async (req, res) => {
  const { sessionId, initialContent } = req.body;

  try {
    let titleResponse;

    // Use GPT to generate a title based on the initial conversation content
    if (APIChannel === "OpenAI") {
      titleResponse = await requestOpenai('/v1/chat/completions', {
        model: currentModel,
        num_ctx: contextWindowSize,
        max_tokens: 100,
        messages: [{ role: "user", content: `You are acting as a tool for conversation title creation. Create a concise title, preferably under 4 words, that encapsulates the essence of a conversation. Use abbreviations where necessary to keep it brief. The title should clearly indicate the main topic or possible theme of the input. The title's language MUST be the same as the input's language, like "用户问候" for "你好". REMEMBER: DO NOT include double quotation marks in the title, you don't need to reply anything other than the title itself. [Input: ${initialContent}]`}],
      });
    } else if (APIChannel === "Ollama") {
      titleResponse = await requestOllama('/api/chat', {
        model: currentModel,
        stream: false,
        messages: [{ role: "user", content: `You are acting as a tool for conversation title creation. Create a concise title, preferably under 4 words, that encapsulates the essence of a conversation. Use abbreviations where necessary to keep it brief. The title should clearly indicate the main topic or possible theme of the input. The title's language MUST be the same as the input's language, like "用户问候" for "你好". REMEMBER: DO NOT include double quotation marks in the title, you don't need to reply anything other than the title itself. [Input: ${initialContent}]`}],
        options: {
          num_predict: 100,
          num_ctx: contextWindowSize
        }
      });
    } else {
      throw new Error('Invalid APIChannel specified');
    }

    const title = titleResponse.choices[0].message.content;

    // Update the session title in the database
    const updatedSession = await ChatSession.findByIdAndUpdate(
      sessionId,
      { title },
      { new: true }
    );

    if (!updatedSession) {
      return res.status(404).send('Session not found');
    }

    // Send back the updated session as a response
    res.json(updatedSession);
  } catch (error) {
    console.error('Error updating session title:', error);
    res.status(500).send('Error updating session title');
  }
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
    
    // Update the session with the user's message immediately
    session.messages = messages;
    session.updatedAt = new Date();
    await session.save();

    res.status(200).send('Message received');
  } catch (error) {
    console.error('Error with OpenAI API or database:', error);
    res.status(500).send('Error processing request');
  }
});

// Stream Message
app.get('/stream-message', async (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).send('Session ID is required.');
  }

  try {
    const session = await ChatSession.findById(sessionId);
    if (!session) return res.status(404).send('Session not found');

    const messages = session.messages;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let stream;

    if (APIChannel === "OpenAI") {
      stream = await requestOpenai('/v1/chat/completions', {
        model: currentModel,
        num_ctx: contextWindowSize,
        max_tokens: 4096,
        stream: true,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      });

      let botReply = '';
      let buffer = '';

      stream.on('data', (chunk) => {
        buffer += chunk.toString();

        let boundary = buffer.indexOf('\n');

        while (boundary !== -1) {
          let formattedChunkString = buffer.slice(0, boundary).trim();

          buffer = buffer.slice(boundary + 1);
          boundary = buffer.indexOf('\n');

          // 移除所有行的 'data: ' 前缀
          if (formattedChunkString.startsWith('data: ')) {
            formattedChunkString = formattedChunkString.replace(/^data: /, '');
          }

          console.log(formattedChunkString);

          if (formattedChunkString === '') {
            continue;
          }

          if (formattedChunkString === '[DONE]') {
            res.write('data: [DONE]\n\n');
            res.end();
            return;
          }

          try {
            const parsedChunk = JSON.parse(formattedChunkString);
            const deltaContent = parsedChunk.choices[0].delta?.content || '';
            if (deltaContent) {
              botReply += deltaContent;
            }

            res.write(`data: ${JSON.stringify(parsedChunk)}\n\n`);
          } catch (err) {
            console.error('Failed to parse chunk:', err);
          }
        }
      });

      stream.on('end', async () => {
        // 确保缓冲区中的剩余数据也被处理
        if (buffer.trim() !== '') {
          try {
            const parsedChunk = JSON.parse(buffer.trim());
            const deltaContent = parsedChunk.choices[0].delta?.content || '';
            if (deltaContent) {
              botReply += deltaContent;
            }

            res.write(`data: ${JSON.stringify(parsedChunk)}\n\n`);
          } catch (err) {
            console.error('Failed to parse final chunk:', err);
          }
        }

        res.write('data: [DONE]\n\n');
        res.end();

        if (botReply) {
          messages.push({ role: "assistant", content: botReply });
          console.log("Bot Replies: " + botReply);
        }

        session.messages = messages;
        session.updatedAt = new Date();
        await session.save().catch(error => {
          console.error('Error saving session:', error);
        });
      });

      stream.on('error', (error) => {
        console.error('Stream error:', error);
        res.status(500).send('Stream error');
      });
    } else if (APIChannel === "Ollama") {
      stream = await requestOpenai('/api/chat', {
        model: currentModel,
        stream: true,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        options: {
          // num_predict: 20,
          num_ctx: contextWindowSize
        }
      });
  
      let botReply = '';
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity
      });
  
      rl.on('line', (line) => {
        if (line.trim() === '') {
          return;
        }
  
        try {
          const parsedChunk = JSON.parse(line);
          const deltaContent = parsedChunk.message?.content || '';
          console.log(parsedChunk);
          if (deltaContent) {
            botReply += deltaContent;
          }
  
          res.write(`data: ${JSON.stringify(parsedChunk)}\n\n`);
  
          if (parsedChunk.done) {
            res.write('data: [DONE]\n\n');
            res.end();
            rl.close();
          }
        } catch (err) {
          console.error('Failed to parse chunk:', err);
        }
      });
  
      rl.on('close', async () => {
        if (botReply) {
          messages.push({ role: "assistant", content: botReply });
          console.log("Bot Replies: " + botReply);
        }
  
        session.messages = messages;
        session.updatedAt = new Date();
        await session.save().catch(error => {
          console.error('Error saving session:', error);
        });
      });
  
      rl.on('error', (error) => {
        console.error('Stream error:', error);
        res.status(500).send('Stream error');
      });
    } else {
      throw new Error('Invalid APIChannel specified');
    }

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

app.put('/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const { title } = req.body;

  try {
    // Assuming `updatedAt` is automatically handled by your ORM
    const updatedSession = await ChatSession.findByIdAndUpdate(
      sessionId, 
      { title, updatedAt: new Date() },
      { new: true } // Return the updated document
    );

    if (!updatedSession) {
      return res.status(404).send('Session not found');
    }

    res.json(updatedSession); // Send back the updated session
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).send('Error updating session');
  }
});

app.delete('/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  try {
    const deletedSession = await ChatSession.findByIdAndDelete(sessionId);
    if (!deletedSession) {
      return res.status(404).send('Session not found');
    }
    res.status(200).send('Session deleted');
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).send('Error deleting session');
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

// 获取当前模型
app.get('/current-model', (req, res) => {
  res.json({ model: currentModel });
});

// 设置当前模型
app.post('/set-model', (req, res) => {
  const { model } = req.body;
  if (model) {
    currentModel = model;
    res.json({ success: true, model: currentModel });
  } else {
    res.status(400).json({ success: false, message: 'Model name is required' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});