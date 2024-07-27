import logo from './logo.svg';
import './normal.css';
import './App.css';
import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// Choose a style theme from react-syntax-highlighter/dist/esm/styles/prism
import { a11yDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const models = [
  "gpt-3.5-turbo",
  "gemma2:27b-instruct-q8_0",
  "llama3:70b",
  "qwen2:72b",
  "llama3.1:70b",
  "claude-3-sonnet-20240229"
];

function App() {
  const [input, setInput] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [isHovered, setIsHovered] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [originalTitle, setOriginalTitle] = useState("");
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [selectedSessionForActions, setSelectedSessionForActions] = useState(null);
  const [selectedModel, setSelectedModel] = useState(models[0]);
  const moreActionsRef = useRef(null);
  const textareaRef = useRef(null);
  const eventSourceRef = useRef(null);

  // 调整textarea高度的函数
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto"; // 重置高度
      // 确保高度不超过最大值144px
      // textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
      const newHeight = Math.max(21.83, Math.min(textarea.scrollHeight, 256));
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [input]); // 每次输入变化时调用

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (!isTitleEditing) {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          // 在光标位置插入换行符
          e.preventDefault();
          const textarea = textareaRef.current;
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newValue = input.substring(0, start) + '\n' + input.substring(end);
          setInput(newValue);
          textarea.setSelectionRange(start + 1, start + 1);
        } else {
          // 提交表单
          e.preventDefault();
          handleSubmit(e);
        }
      }
    }
  };


  // 获取当前模型
  useEffect(() => {
    async function fetchCurrentModel() {
      try {
        const response = await fetch('http://localhost:3080/current-model');
        const data = await response.json();
        setSelectedModel(data.model);
      } catch (error) {
        console.error('Error fetching current model:', error);
      }
    }
    fetchCurrentModel();
  }, []);

  const handleModelChange = async (e) => {
    const selectedModel = e.target.value;
    setSelectedModel(selectedModel);
    
    try {
      const response = await fetch('http://localhost:3080/set-model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel }),
      });

      if (!response.ok) {
        throw new Error('Failed to update model');
      }

      const result = await response.json();
      console.log(result.message, result.model);
    } catch (error) {
      console.error('Error updating model:', error);
    }
  };

  // Function for session-list
  const handleMouseEnter = (sessionId) => {
    setIsHovered(sessionId);
  };
  
  const handleMouseLeave = (sessionId) => {
    // Close the hover state only if the more actions menu is not showing for this session
    if (selectedSessionForActions !== sessionId) {
      setIsHovered(null);
    }
  };

  // Function to enter title edit mode
  const handleEditNameClick = (sessionId, currentTitle) => {
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
    setOriginalTitle(currentTitle);
    setIsTitleEditing(true);
  };

  // Function to save new title
  const handleConfirmEdit = async () => {
    if (editingTitle !== originalTitle) {
      if (editingSessionId && editingTitle.trim() !== "") {
        // Send the update to the server
        try {
          const response = await fetch(`http://localhost:3080/sessions/${editingSessionId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ title: editingTitle }),
          });
    
          if (!response.ok) {
            throw new Error('Failed to update session title');
          }
    
          const updatedSession = await response.json();
          // Update the session title in the local state with the response from the server
          setSessions(sessions.map((session) =>
            session._id === editingSessionId ? updatedSession : session
          ));
    
          console.log('Session title updated successfully');
        } catch (error) {
          console.error('Error updating session title:', error);
        }
      }
    
      // Exit edit mode
      setEditingSessionId(null);
      setEditingTitle(""); // Reset the editing title
      setIsTitleEditing(false);
    } else {
      // If title is unchanged, just exit edit mode without updating
      handleCancelEdit();
    }
  };

  // Function to cancel editing
  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingTitle("");
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleConfirmEdit();
    } else if (event.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleBlur = () => {
    handleConfirmEdit();
  };
  
  const handleMoreFunctionsClick = (e, sessionId) => {
    e.stopPropagation();
    if (selectedSessionForActions === sessionId) {
      setShowMoreActions(!showMoreActions);
    } else {
      setSelectedSessionForActions(sessionId);
      setShowMoreActions(true);
    }
  };

  const handleClickOutside = (event) => {
    if (moreActionsRef.current && !moreActionsRef.current.contains(event.target)) {
      closeMoreActions();
    }
  };

  // Close the more actions menu when clicking outside of it
  const closeMoreActions = () => {
    setShowMoreActions(false);
    setSelectedSessionForActions(null);
    setIsHovered(null); // Add this line to reset hover state when closing the actions menu
  };

  const handleDeleteChat = async (sessionId) => {
    if (window.confirm('Are you sure you want to delete this chat?')) {
      try {
        const response = await fetch(`http://localhost:3080/sessions/${sessionId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          throw new Error('Failed to delete session');
        }
        
        // Remove the deleted session from state
        setSessions(sessions.filter((session) => session._id !== sessionId));
  
        // If the deleted session is the active session, clear the active session
        if (activeSession === sessionId) {
          setActiveSession(null);
          setChatLog([]);
        }
  
        // Close the actions popup
        setShowMoreActions(false);
  
        console.log('Session deleted successfully');
      } catch (error) {
        console.error('Error deleting session:', error);
      }
    }
  };

  useEffect(() => {
    // Attach the listeners on component mount.
    document.addEventListener('click', handleClickOutside, true);
    
    // Detach the listeners on component unmount.
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, []);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    const response = await fetch("http://localhost:3080/sessions");
    const data = await response.json();
    setSessions(data);
    if (data.length > 0 && !activeSession) {
      setActiveSession(data[0]._id); // Set the first session as active by default if no active session is set
      fetchChatLog(data[0]._id); // Fetch the chat log for the first session
    }
  }

  async function fetchChatLog(sessionId) {
    try {
      const response = await fetch(`http://localhost:3080/sessions/${sessionId}`);
      if (!response.ok) throw new Error("Failed to fetch session");
      const { messages } = await response.json();
      setChatLog(messages);
    } catch (error) {
      console.error("Error fetching session:", error);
    }
  }

  function handleSessionClick(sessionId) {
    setActiveSession(sessionId);
    fetchChatLog(sessionId); // Fetch and set the chat log for the selected session
  }

  const clearChatForNew = () => {
    setChatLog([]);
    setActiveSession(null); // Clear the active session
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
  
    try {
      // If there's no active session, create a new session and use its ID
      let currentSessionId = activeSession;
      if (!currentSessionId) {
        currentSessionId = await createNewSession();
        // Directly update the active session state
        setActiveSession(currentSessionId);
      }
  
      const userMessage = { sessionId: currentSessionId, message: input };
      await sendMessage(userMessage);
  
      // Fetch the updated chat log for the current session to include the new message
      await fetchChatLog(currentSessionId);
      fetchSessions();
    } catch (error) {
      console.error("Error handling submit:", error);
    }
  };
  
  async function createNewSession() {
    try {
      const response = await fetch("http://localhost:3080/new-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat", category: "Instant Chat" }),
      });
      if (!response.ok) {
        throw new Error("Failed to create new session");
      }
      const { id } = await response.json();
      // setActiveSession(id); // Set the newly created session as active
      // setChatLog([]); // Clear the chat log for the new session
      // fetchSessions(); // Optionally, refresh the session list
      return id; // Return the new session ID to be used immediately
    } catch (error) {
      console.error("Error creating new session:", error);
    }
  }

  const updateSessionTitle = async (sessionId, initialContent) => {
  try {
    const response = await fetch('http://localhost:3080/auto-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, initialContent }),
    });

    if (!response.ok) {
      throw new Error('Failed to update session title');
    }

    // Assuming the updated session is returned in the response
    const updatedSession = await response.json();
    console.log('Session title updated:', updatedSession.title);

    // Refresh session list to reflect the updated title
    fetchSessions(); // Assuming fetchSessions is a function that updates your session list in the frontend
    } catch (error) {
      console.error('Error updating session title:', error);
    }
  };
  
  async function sendMessage(userMessage) {
    try {
      // Add the user's message to the chat log immediately with the correct role
      setChatLog(prevLog => [...prevLog, { role: "user", content: userMessage.message }]);
      const newChatLogWithUserMessage = [...chatLog, { role: "user", content: userMessage.message }];
      setInput(""); //Clear the input after sending
      adjustTextareaHeight();

      // Clear previous EventSource if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      await fetch("http://localhost:3080/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userMessage),
      });

      eventSourceRef.current = new EventSource(`http://localhost:3080/stream-message?sessionId=${userMessage.sessionId}`);
      let botReply = '';
      let lastIndex = newChatLogWithUserMessage.length;

      eventSourceRef.current.onmessage = function (event) {
        if (event.data === '[DONE]') {
          eventSourceRef.current.close();
          const finalNewChatLog = [...newChatLogWithUserMessage, { role: "assistant", content: botReply }];
          console.log(finalNewChatLog.length);

          if (finalNewChatLog.length <= 3) {
            updateSessionTitle(userMessage.sessionId, userMessage.message);
          }
          return;
        }

        const messageData = JSON.parse(event.data);
        const deltaContent = messageData.choices[0].delta?.content || '';
        // const deltaContent = messageData.message?.content || '';
        botReply += deltaContent;

        setChatLog(prevLog => {
          const newLog = [...prevLog];
          const botMessageIndex = newLog.findIndex((msg, index) => index === lastIndex);

          if (botMessageIndex !== -1) {
            newLog[botMessageIndex].content = botReply;
          } else {
            newLog.push({ role: "assistant", content: botReply, complete: false });
          }

          return newLog;
        });
      };

      eventSourceRef.current.onerror = function (event) {
        console.error("EventSource failed:", event);
        eventSourceRef.current.close();
      };

      eventSourceRef.current.onclose = function () {
        console.log('Stream closed');
      };
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }

  // 动态调整全局 pre 元素的宽度
  useEffect(() => {
    const resizePreElements = () => {
      const pres = document.querySelectorAll('pre');
      pres.forEach(pre => {
        const windowWidth = window.innerWidth;
        if (windowWidth >= 1060) {
          pre.style.width = '655px';
        } else {
          pre.style.width = `${windowWidth - 405}px`;
        }
      });
    };

    // Initial resize
    resizePreElements();

    // Add event listener for window resize
    window.addEventListener('resize', resizePreElements);

    // Cleanup event listener on unmount
    return () => {
      window.removeEventListener('resize', resizePreElements);
    };
  }, []);
  
  return (
    <div className="App">
      <aside className="sidemenu">
        <div className="app-main-title">
          <h2>Motor's ChatBot</h2>
        </div>
        <div className="session-list">
          <div className="new-chat-button" onClick={clearChatForNew}>
            <span>+</span>
            New Chat
          </div>
          {sessions.map((session) => (
            <div
            key={session._id}
            className={`session-item ${activeSession === session._id ? "active" : ""}`}
            onMouseEnter={() => handleMouseEnter(session._id)}
            onMouseLeave={() => handleMouseLeave(session._id)}
            >
              {editingSessionId === session._id ? (
                <input
                autoFocus
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyPress}
                className="title-edit-input"
                />
              ) : (
                <span
                  className="session-title"
                  onClick={() => handleSessionClick(session._id)}
                >
                  {session.title}
                  <div className="fade-mask"></div>
                </span>
              )}
              
              {/* Conditionally render edit and more buttons */}
              {((isHovered === session._id || activeSession === session._id) && editingSessionId !== session._id) && (
                <div className="session-actions">
                  <div className="edit-name-button" onClick={() => handleEditNameClick(session._id, session.title)}>
                    <svg t="1706429867923" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7518" width="16" height="16"><path d="M554.666667 128v85.333333H213.333333v597.333334h597.333334v-341.333334h85.333333v341.333334a85.333333 85.333333 0 0 1-85.333333 85.333333H213.333333a85.333333 85.333333 0 0 1-85.333333-85.333333V213.333333a85.333333 85.333333 0 0 1 85.333333-85.333333h341.333334zM397.994667 568.661333l426.666666-426.666666 60.373334 60.373333-426.666667 426.666667-60.373333-60.373334z" fill="#ececf1" p-id="7519"></path></svg>
                  </div>
                  <div className="more-functions-button" onClick={(e) => handleMoreFunctionsClick(e, session._id)}>
                    <svg t="1706429736531" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6301" width="18" height="18"><path d="M243.2 512m-83.2 0a1.3 1.3 0 1 0 166.4 0 1.3 1.3 0 1 0-166.4 0Z" fill="#ececf1" p-id="6302"></path><path d="M512 512m-83.2 0a1.3 1.3 0 1 0 166.4 0 1.3 1.3 0 1 0-166.4 0Z" fill="#ececf1" p-id="6303"></path><path d="M780.8 512m-83.2 0a1.3 1.3 0 1 0 166.4 0 1.3 1.3 0 1 0-166.4 0Z" fill="#ececf1" p-id="6304"></path></svg>
                  </div>
                  {showMoreActions && selectedSessionForActions === session._id && (
                    <div className="more-actions-popup" ref={moreActionsRef}>
                      <ul>
                        <li>Recategorize</li>
                        <li>Share</li>
                        <li className="chat-delet-action" onClick={() => handleDeleteChat(session._id)}>Delete Chat</li>
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="profile-space">
          <div className="user-profile">
            <div className="user-avatar">
              <img src="https://i.imgur.com/0UY4ifV.jpeg" alt="User Avatar" className="user-icon-image"/>
            </div>
            <div className="user-name">Motor Cheng</div>
          </div>
        </div>
      </aside>
      <section className="chatbox">
        <div className="chat-box-bar">
          <h3>Current Model: </h3>
          <div className="bar-objects" id="model-select">
            <select className="model-selection" value={selectedModel} onChange={handleModelChange}>
              {models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>
          <div className="bar-objects" id="sys-prompt">
            <button>System Prompt</button>
          </div>
        </div>
        <div className="chat-log">
          {chatLog.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
        </div>
        <div className="text-input-holder">
          <div className="text-input-textarea">
            <form id="submitform" onSubmit={handleSubmit}>
              <textarea
                form ="submitform"
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="text-input"
                placeholder="Type your message..."
                rows={1}
              />
              <button className="text-action-button">S</button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

const CodeBlock = ({ language, value }) => {
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(
      () => console.log('Content copied to clipboard!'),
      (err) => console.error('Failed to copy content: ', err)
    );
  };

  return (
    <div className="code-container">
      <div className="code-header">
        <span className="code-language-block-bar">{language}</span>
        <div className="copy-block-bar" onClick={handleCopy}>Copy</div>
      </div>
      <SyntaxHighlighter
      language={language}
      style={a11yDark}
      customStyle={{ margin: 0 }} // Remove margin from the <pre> tag
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

const ChatMessage = ({ message }) => {
  const isBotMessage = message.role === "assistant";
  const isUserMessage = message.role === "user";

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(
      () => console.log("Text copied to clipboard"),
      (err) => console.error("Failed to copy text: ", err)
    );
  };

  return (
    <div className={`chat-message ${isBotMessage ? "chatgpt" : "user"}`}>
      <div className={`avatar ${isBotMessage ? "chatgpt" : "user"}`}>
        {isBotMessage && (
          <svg t="1705784673414" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2564" width="24" height="24"><path d="M956.408445 419.226665a250.670939 250.670939 0 0 0-22.425219-209.609236A263.163526 263.163526 0 0 0 652.490412 85.715535 259.784384 259.784384 0 0 0 457.728923 0.008192a261.422756 261.422756 0 0 0-249.44216 178.582564 258.453206 258.453206 0 0 0-172.848261 123.901894c-57.03583 96.868753-44.031251 219.132275 32.153053 302.279661a250.670939 250.670939 0 0 0 22.32282 209.609237 263.163526 263.163526 0 0 0 281.595213 123.901893A259.067596 259.067596 0 0 0 566.271077 1023.990784a260.60357 260.60357 0 0 0 249.339762-178.889759 258.453206 258.453206 0 0 0 172.848261-123.901893c57.445423-96.868753 44.13365-218.82508-32.050655-302.074865zM566.578272 957.124721c-45.362429 0-89.496079-15.666934-124.516283-44.543243 1.638372-0.921584 4.198329-2.150363 6.143895-3.481541l206.537289-117.757998a32.35785 32.35785 0 0 0 16.895713-29.081105V474.82892l87.243317 49.97035c1.023983 0.307195 1.638372 1.228779 1.638372 2.252762v238.075953c0 105.8798-86.936122 191.689541-193.942303 191.996736zM148.588578 781.102113a189.846373 189.846373 0 0 1-23.346803-128.612213c1.535974 1.023983 4.09593 2.559956 6.143895 3.48154L337.922959 773.729439c10.444622 6.143896 23.346803 6.143896 34.098621 0l252.30931-143.664758v99.531108c0 1.023983-0.307195 1.945567-1.331177 2.559956l-208.892449 118.986778a196.297463 196.297463 0 0 1-265.518686-70.04041zM94.112704 335.97688c22.630015-39.013737 58.367008-68.81163 101.16948-84.171369V494.591784c0 11.7758 6.45109 22.93721 16.793315 28.978707l252.30931 143.767156L377.141493 716.796006a3.174346 3.174346 0 0 1-2.867152 0.307195l-208.892448-118.986777A190.870355 190.870355 0 0 1 94.215102 335.874482z m717.607001 164.861198L559.410394 357.070922 646.653711 307.20297a3.174346 3.174346 0 0 1 2.969549-0.307195l208.892449 118.986777a190.358364 190.358364 0 0 1 70.961994 262.139544 194.556693 194.556693 0 0 1-101.16948 84.171369V529.407192a31.538664 31.538664 0 0 0-16.588518-28.671513z m87.03852-129.329002c-1.74077-1.023983-4.300727-2.559956-6.246294-3.48154l-206.639687-117.757999a34.09862 34.09862 0 0 0-33.996222 0L399.566711 393.934295v-99.531108c0-1.023983 0.307195-1.945567 1.331178-2.559956l208.892449-119.089176a195.990268 195.990268 0 0 1 265.518686 70.450003c22.732414 38.706542 31.129071 84.171369 23.346803 128.305018zM352.258716 548.862861l-87.243317-49.560757a2.457558 2.457558 0 0 1-1.638372-2.252762V258.870991c0-105.8798 87.243317-191.996736 194.556692-191.689541a194.556693 194.556693 0 0 1 124.209089 44.543243c-1.638372 0.921584-4.198329 2.252762-6.143896 3.48154l-206.639687 117.757999a31.948257 31.948257 0 0 0-16.793315 29.081105l-0.307194 286.715126z m47.307995-100.759887L512 384.001664l112.535687 63.998912v127.997824l-112.228492 63.998912-112.535687-63.998912-0.307195-127.997824z" p-id="2565" fill="#ffffff"></path></svg>
        )}
        {isUserMessage && (
          <img src="https://i.imgur.com/0UY4ifV.jpeg" alt="User Avatar" className="chat-icon-image"/>
        )}
      </div>
      <div className="message-content">
        <div className="message-title">{isBotMessage ? "ChatBot" : "Me"}</div>
        <div className={`message-detail ${isBotMessage ? '' : 'user-message'}`}>
          {isBotMessage ? (
            // Render bot's markdown reply
            <ReactMarkdown
              children={message.content}
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <CodeBlock language={match[1]} value={String(children).replace(/\n$/, '')} {...props} />
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            />
          ) : (
            // Render user's message as plain text
            message.content
          )}
        </div>
        {isUserMessage && (
          <div className="edit-icon-container">
            <div className="edit-icon">
              <svg t="1705879506075" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4213" width="16" height="16"><path d="M853.333333 501.333333c-17.066667 0-32 14.933333-32 32v320c0 6.4-4.266667 10.666667-10.666666 10.666667H170.666667c-6.4 0-10.666667-4.266667-10.666667-10.666667V213.333333c0-6.4 4.266667-10.666667 10.666667-10.666666h320c17.066667 0 32-14.933333 32-32s-14.933333-32-32-32H170.666667c-40.533333 0-74.666667 34.133333-74.666667 74.666666v640c0 40.533333 34.133333 74.666667 74.666667 74.666667h640c40.533333 0 74.666667-34.133333 74.666666-74.666667V533.333333c0-17.066667-14.933333-32-32-32z" fill="#8a8a8a" p-id="4214"></path><path d="M405.333333 484.266667l-32 125.866666c-2.133333 10.666667 0 23.466667 8.533334 29.866667 6.4 6.4 14.933333 8.533333 23.466666 8.533333h8.533334l125.866666-32c6.4-2.133333 10.666667-4.266667 14.933334-8.533333l300.8-300.8c38.4-38.4 38.4-102.4 0-140.8-38.4-38.4-102.4-38.4-140.8 0L413.866667 469.333333c-4.266667 4.266667-6.4 8.533333-8.533334 14.933334z m59.733334 23.466666L761.6 213.333333c12.8-12.8 36.266667-12.8 49.066667 0 12.8 12.8 12.8 36.266667 0 49.066667L516.266667 558.933333l-66.133334 17.066667 14.933334-68.266667z" fill="#8a8a8a" p-id="4215"></path></svg>
            </div>
          </div>
        )}
        {isBotMessage && (
          <div className="bot-icon-container">
            <div className="botmsg-icon" onClick={() => copyToClipboard(message.content)}>
              <svg t="1705898286996" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="15077" width="16" height="16"><path d="M512 42.666667a85.333333 85.333333 0 0 1 85.333333 85.333333h170.666667a128 128 0 0 1 128 128v554.666667a128 128 0 0 1-128 128H256a128 128 0 0 1-128-128V256a128 128 0 0 1 128-128h170.666667a85.333333 85.333333 0 0 1 85.333333-85.333333zM341.333333 192H256A64 64 0 0 0 192 256v554.666667A64 64 0 0 0 256 874.666667h512a64 64 0 0 0 64-64V256A64 64 0 0 0 768 192h-85.333333V256a42.666667 42.666667 0 0 1-42.666667 42.666667H384a42.666667 42.666667 0 0 1-42.666667-42.666667V192z m170.666667 416a32 32 0 1 1 0 64H341.333333a32 32 0 1 1 0-64h170.666667z m170.666667-170.666667a32 32 0 0 1 0 64H341.333333a32 32 0 1 1 0-64h341.333334zM512 106.666667a21.333333 21.333333 0 0 0-21.333333 21.333333 64 64 0 0 1-57.856 63.701333L426.666667 192h-21.333334v42.666667h213.333334v-42.666667H597.333333A64 64 0 0 1 533.333333 128a21.333333 21.333333 0 0 0-21.333333-21.333333z" fill="#8a8a8a" p-id="15078"></path></svg>
            </div>
            <div className="botmsg-icon">
              <svg t="1705898016033" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="4479" width="16" height="16"><path d="M512 192a320 320 0 1 0 316.544 272.725333c-2.858667-19.370667 11.306667-38.058667 30.890667-38.058666 15.786667 0 29.696 10.922667 32.085333 26.581333A384 384 0 1 1 768 225.792V181.333333a32 32 0 0 1 64 0v128a32 32 0 0 1-32 32h-128a32 32 0 0 1 0-64h57.6a318.890667 318.890667 0 0 0-217.6-85.333333z" fill="#8a8a8a" p-id="4480"></path></svg>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
export default App;
