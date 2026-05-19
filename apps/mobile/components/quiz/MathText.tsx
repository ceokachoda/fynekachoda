import { useMemo, useState } from "react";
import { Platform, Text, View } from "react-native";
import { WebView } from "react-native-webview";

interface Props {
  markdown: string;
  color?: string;
  fontSize?: number;
}

const MATH_DETECT = /\$\$?[^$]+\$\$?|\\\(|\\\[/;

// Tiny HTML escaper for the non-math fragments.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Render very-basic markdown into HTML: bold + italic + linebreaks. We don't
// pull a full markdown library on purpose — the bundle hit is too big for the
// minimal formatting needs of a quiz prompt.
function renderInlineMd(md: string): string {
  return escapeHtml(md)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

function buildKatexHtml(
  markdown: string,
  color: string,
  fontSize: number,
): string {
  // Replace math delimiters with placeholder spans that KaTeX auto-render
  // will recognise. We keep the original delimiters and let `auto-render` do
  // the work.
  const safeBody = renderInlineMd(markdown);
  return `<!doctype html><html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css">
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js"></script>
<script defer src="https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/contrib/auto-render.min.js"></script>
<style>
  html,body { margin:0; padding:0; background:transparent; color:${color}; font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif; font-size:${fontSize}px; line-height:1.5; }
  .root { padding:0; }
  .katex { font-size:1em; }
  .katex-display { margin:.6em 0; }
</style>
</head><body>
<div id="root" class="root">${safeBody}</div>
<script>
  function postHeight(){
    var h = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(String(h));
  }
  function render(){
    try {
      renderMathInElement(document.getElementById('root'), {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$',  right: '$',  display: false },
          { left: '\\\\[', right: '\\\\]', display: true },
          { left: '\\\\(', right: '\\\\)', display: false },
        ],
        throwOnError: false,
      });
    } catch (e) { /* leave raw */ }
    requestAnimationFrame(postHeight);
    setTimeout(postHeight, 200);
    setTimeout(postHeight, 600);
  }
  window.addEventListener('load', render);
</script>
</body></html>`;
}

// Renders a markdown-ish string with optional KaTeX math. If the input has
// no math delimiters we render plain Text — keeping the WebView budget low
// on Redmi 8A class devices. KaTeX is loaded from cdnjs (D-168 mirrors the
// Phase 5 pdf.js pattern; bundle-locally is Phase 9 hardening).
export function MathText({ markdown, color = "#1e293b", fontSize = 16 }: Props) {
  const hasMath = useMemo(() => MATH_DETECT.test(markdown), [markdown]);
  const html = useMemo(
    () => (hasMath ? buildKatexHtml(markdown, color, fontSize) : ""),
    [hasMath, markdown, color, fontSize],
  );
  const [height, setHeight] = useState(28);

  if (!hasMath) {
    return (
      <Text style={{ color, fontSize, lineHeight: fontSize * 1.45 }}>
        {markdown}
      </Text>
    );
  }

  return (
    <View style={{ width: "100%", minHeight: 28, height }}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        style={{ flex: 1, backgroundColor: "transparent" }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        scalesPageToFit={Platform.OS === "android" ? false : undefined}
        javaScriptEnabled
        domStorageEnabled
        nestedScrollEnabled
        androidLayerType="hardware"
        onMessage={(evt) => {
          const h = parseInt(evt.nativeEvent.data, 10);
          if (!isNaN(h) && h > 0 && Math.abs(h - height) > 2) {
            setHeight(h);
          }
        }}
      />
    </View>
  );
}
