export default function ChatLanding() {
  return (
    <main className="page">
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <span className="brandDot" />
            <div>
              <p className="brandTitle">Autonomous Game Engineer</p>
              <p className="brandMeta">Codex-powered game systems</p>
            </div>
          </div>
          <div className="topbarActions">
            <span className="statusPill">Live Demo</span>
            <button className="ghostButton" type="button">
              New Session
            </button>
          </div>
        </header>

        <section className="hero">
          <p className="eyebrow">Chat-first game creation</p>
          <h1>Design a playable system through conversation.</h1>
          <p className="lede">
            Describe mechanics, constraints, and win conditions, or upload a
            syllabus to derive the game structure.
          </p>
        </section>

        <section className="grid">
          <div className="panel chatPanel">
            <div className="panelHeader">
              <div>
                <h2>Session</h2>
                <p>Draft your spec in chat, then trigger the pipeline.</p>
              </div>
              <div className="pill">Spec Builder</div>
            </div>

            <div className="chatWindow">
              <div className="messages">
                <div className="message system">
                  <p>
                    Welcome. Try: “Build a dodge game with 3 lives and increasing
                    speed.”
                  </p>
                </div>
                <div className="message user">
                  <p>
                    I want a physics-based runner with simple obstacles and a
                    90-second timer.
                  </p>
                </div>
                <div className="message assistant">
                  <p>
                    Got it. I’ll draft mechanics, constraints, and success
                    conditions.
                  </p>
                </div>
              </div>
              <div className="inputRow">
                <input
                  className="input"
                  placeholder="Describe the game you want to generate..."
                  type="text"
                />
                <button className="sendButton" type="button">
                  Send
                </button>
              </div>
            </div>
          </div>

          <aside className="panel sidePanel">
            <div className="panelHeader">
              <div>
                <h2>Syllabus Upload</h2>
                <p>Optional input to seed mechanics and progression.</p>
              </div>
            </div>

            <div className="uploadCard">
              <div className="uploadZone">
                <input
                  className="fileInput"
                  id="syllabus-file"
                  type="file"
                  accept=".pdf,.md,.txt,.doc,.docx"
                />
                <label className="uploadButton" htmlFor="syllabus-file">
                  Upload Syllabus
                </label>
                <p className="uploadHint">PDF, Markdown, or text.</p>
              </div>
              <div className="uploadMeta">
                <p className="metaTitle">What happens next</p>
                <ul className="metaList">
                  <li>Extract key concepts</li>
                  <li>Map concepts to mechanics</li>
                  <li>Generate a playable system</li>
                </ul>
              </div>
            </div>

            <div className="pipeline">
              <p className="metaTitle">Pipeline Steps</p>
              <div className="stepGrid">
                <div className="stepCard">Design</div>
                <div className="stepCard">Build</div>
                <div className="stepCard">Playtest</div>
                <div className="stepCard">Fix</div>
              </div>
              <button className="primaryButton" type="button">
                Run Pipeline
              </button>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
