import { useEffect, useRef } from "react";
import { createScene } from "./scene/createScene.js";
import { profile, assistant, playlists } from "./content.js";
import Chat from "./components/Chat.jsx";
import Deck from "./components/Deck.jsx";
import Clock from "./components/Clock.jsx";

export default function App() {
  const sceneRef = useRef(null);

  // mount the 3D layer once
  useEffect(() => {
    document.querySelector("#bigtype span").innerHTML = profile.bigWord.map((w) => `<b>${w}</b>`).join("");
    // no WebGL (old devices, locked-down browsers): skip the 3D layer, the chat still works
    try {
      sceneRef.current = createScene({
        canvas: document.getElementById("gl"),
        tip: document.getElementById("tip"),
        playlists,
        headAsk: assistant.headAsk
      });
    } catch (e) { console.warn("3D scene unavailable:", e.message); }
    return () => sceneRef.current?.dispose();
  }, []);

  return (
    <div id="hud">
      <div className="top">
        <div className="mark">
          <b><em></em>{profile.name}</b>
          <small>{profile.title}</small>
        </div>
        <Clock />
      </div>
      <div></div>
      <div className="bottom">
        <Chat />
        <Deck onSelect={(i) => sceneRef.current?.setRecord(i)} />
      </div>
    </div>
  );
}
