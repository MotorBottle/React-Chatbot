import logo from './logo.svg';
import './normal.css';
import './App.css';
import React, { useState, useEffect } from 'react';


function App() {

  const [input, setInput] = useState("");
  const [chatLog, setChatLog] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [isHovered, setIsHovered] = useState(null);

  const handleMouseEnter = (sessionId) => {
    setIsHovered(sessionId);
  };
  
  const handleMouseLeave = () => {
    setIsHovered(null);
  };

  const handleEditNameClick = (e, sessionId) => {
    e.stopPropagation();
    // Implement renaming logic here
  };
  
  const handleMoreFunctionsClick = (e, sessionId) => {
    e.stopPropagation();
    // Implement logic to show more functions (delete, archive) here
  };

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
      // setInput(""); // NOTE: moved to sendMessage already
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
  
  async function sendMessage(userMessage) {
    try {
      // Add the user's message to the chat log immediately with the correct role
      setChatLog(prevLog => [...prevLog, { role: "user", content: userMessage.message }]);
      setInput(""); //Clear the input after sending

      const response = await fetch("http://localhost:3080/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userMessage),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      
      const { reply } = await response.json();
      // Add the bot's reply to the chat log with the correct role
      setChatLog(prevLog => [...prevLog, { role: "assistant", content: reply }]);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  }
  
  
  
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
            onMouseLeave={handleMouseLeave}
            onClick={() => handleSessionClick(session._id)}
          >
            <span className="session-title">
              {session.title}
              <div className="fade-mask"></div>
            </span>
            
            {/* Conditionally render edit and more buttons */}
            {(isHovered === session._id || activeSession === session._id) && (
              <div className="session-actions">
                <div className="edit-name-button" onClick={(e) => handleEditNameClick(e, session._id)}>
                  <svg t="1706429867923" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="7518" width="16" height="16"><path d="M554.666667 128v85.333333H213.333333v597.333334h597.333334v-341.333334h85.333333v341.333334a85.333333 85.333333 0 0 1-85.333333 85.333333H213.333333a85.333333 85.333333 0 0 1-85.333333-85.333333V213.333333a85.333333 85.333333 0 0 1 85.333333-85.333333h341.333334zM397.994667 568.661333l426.666666-426.666666 60.373334 60.373333-426.666667 426.666667-60.373333-60.373334z" fill="#ececf1" p-id="7519"></path></svg>
                </div>
                <div className="more-functions-button" onClick={(e) => handleMoreFunctionsClick(e, session._id)}>
                  <svg t="1706429736531" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6301" width="18" height="18"><path d="M243.2 512m-83.2 0a1.3 1.3 0 1 0 166.4 0 1.3 1.3 0 1 0-166.4 0Z" fill="#ececf1" p-id="6302"></path><path d="M512 512m-83.2 0a1.3 1.3 0 1 0 166.4 0 1.3 1.3 0 1 0-166.4 0Z" fill="#ececf1" p-id="6303"></path><path d="M780.8 512m-83.2 0a1.3 1.3 0 1 0 166.4 0 1.3 1.3 0 1 0-166.4 0Z" fill="#ececf1" p-id="6304"></path></svg>
                </div>
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
          <h3>GPT-3.5-Turbo</h3>

        </div>
        <div className="chat-log">
          {chatLog.map((message, index) => (
            <ChatMessage key={index} message={message} />
          ))}
        </div>
        <div className="text-input-holder">
          <form onSubmit={handleSubmit}>
            <input
            rows="1"
            value={input}
            onChange={(e)=> setInput(e.target.value)}
            className="text-input-textarea"
            placeholder="Type your message...">
            </input>
          </form>
        </div>
      </section>
    </div>
  );
}

const ChatMessage = ({ message }) => {
  const isBotMessage = message.role === "assistant";
  const isUserMessage = message.role === "user";
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
        <div className="message-detail">
          {message.content}
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
            <div className="botmsg-icon">
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
