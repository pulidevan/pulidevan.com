import React, { useState, useEffect, useRef, useCallback } from "react";
import { audio } from "../utils/audio";

interface Props {
  content: string;
  role: string;
  onComplete?: () => void;
}

/**
 * TypingMessage — animates AI text character by character.
 *
 * Bug fixes:
 * 1. onComplete is wrapped in useCallback / ref to prevent stale closure issues
 *    that previously caused cards to never appear after animation.
 * 2. Effect properly cleans up timeout on unmount or content change.
 * 3. User messages are displayed immediately without any animation.
 */
export const TypingMessage: React.FC<Props> = ({ content, role, onComplete }) => {
  const isAI = role === "ai";
  const [displayedContent, setDisplayedContent] = useState(isAI ? "" : content);
  const hasCompleted = useRef(!isAI);
  const onCompleteRef = useRef(onComplete);

  // Keep onComplete ref fresh without re-triggering the effect
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!isAI) {
      setDisplayedContent(content);
      return;
    }

    // Reset for new AI message
    if (hasCompleted.current) {
      setDisplayedContent(content);
      return;
    }

    setDisplayedContent("");
    let i = 0;
    let timeoutId: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const typeNextChar = () => {
      if (cancelled) return;

      i++;
      setDisplayedContent(content.slice(0, i));

      const char = content[i - 1];
      if (char && Math.random() < 0.75) {
        if (char === " ") {
          audio.playSpacebar();
        } else {
          audio.playTypingTick();
        }
      }

      if (i >= content.length) {
        hasCompleted.current = true;
        // Use ref so we always call the freshest version of onComplete
        onCompleteRef.current?.();
        return;
      }

      const prevChar = content[i - 1];
      let delay = 14;
      if (prevChar === "." || prevChar === "!" || prevChar === "?") {
        delay = 200;
      } else if (prevChar === "," || prevChar === ";" || prevChar === "-") {
        delay = 90;
      } else {
        delay = 10 + Math.random() * 12;
      }

      timeoutId = setTimeout(typeNextChar, delay);
    };

    timeoutId = setTimeout(typeNextChar, 15);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, isAI]);

  return (
    <span>
      {displayedContent}
      {isAI && !hasCompleted.current && (
        <span className="animate-pulse inline-block w-[2px] h-[1em] bg-current ml-[1px] align-middle" />
      )}
    </span>
  );
};
