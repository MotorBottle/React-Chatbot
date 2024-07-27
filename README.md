# React-Chatbot

A ChatGPT clone implemented as a front-end learning project.

## Getting Started

To use: 

1. **Set Up Environment Variables:**
   - Copy the contents of `.env.example` to a new file named `.env`.
   - Fill in your OpenAI API key and MongoDB connection string in the `.env` file.

2. **Install packages:**
    - Remember to install related packages before you run the project. 

3. **Start the Application:**
   - In the root directory, start the server with `node index.js`.
   - Open a new terminal, navigate to the client directory (`cd client`), and start the React app with `npm start`..

4. **(Optional) To use Ollama API instead of openai/one-api:**
   - Start `index_ollama.js` instead of `index.js`
   - Comment this line in App.js: `const deltaContent = messageData.choices[0].delta?.content || '';`
   - Uncomment the line below the last one: `const deltaContent = messageData.message?.content || '';`

5. **Enjoy interacting with your own chatbot~**



## Features

### Involved Tools

- **React:** For building the user interface.
- **MongoDB:** Used for storing conversation histories.
- **Express:** Powers the backend server.

### Development Progress

![alt text](image.png)

#### Completed Features

- Basic User Interface
- Fundamental chat functionality
- Ability to view and continue previous conversations
- Editing titles for exsiting conversations
- Deleting conversations
- Auto generate title for conversations
- Copying responses to clipboard
- Displaying bot's replies in markdown style and codes in code blocks
- Switching between different models - 2024/07/20
- Streamed bot reply - 2024/07/20
- Added support for Ollama's Native API calling -2024/07/25

#### In Progress

- Editing categories for conversations
- Regenerating responses and branching conversations
- Displaying categories in the sidebar
- Providing category recommendations
- Implementing visual branch management for conversation flows
- Multiuser
- Copying fullconversation to clipboard
