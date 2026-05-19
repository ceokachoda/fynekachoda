// Phase 5 — PDF helpers used by the in-app reader.
//
// `createSignedPdfUrl` calls the `content-pdf-sign` edge fn (NOT
// `supabase.storage.createSignedUrl` — that would fail because the deny-all
// `storage.objects` policy blocks SELECT on objects for authenticated/anon).
// The edge fn proves the caller can see the content_items row via RLS, then
// service-roles the signed URL for the underlying object.
//
// `pdfJsViewerHtml` returns a static HTML doc that mounts pdf.js (loaded
// from Mozilla's CDN — stable and standard for in-browser PDF) and renders
// the given URL. The host RN page posts `goPage`/`getTotalPages` messages
// via `injectJavaScript`; the HTML posts `loaded`, `pageChange`, `total`
// events back via `window.ReactNativeWebView.postMessage(JSON.stringify…)`.

import { supabase } from "@/lib/supabase";

export interface PdfSignResponse {
  signed_url: string;
  expires_at: string;
  file_path: string;
}

export async function createSignedPdfUrl(contentId: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<PdfSignResponse>(
    "content-pdf-sign",
    { body: { content_id: contentId } },
  );
  if (error) {
    throw new Error(
      (error as Error & { message?: string }).message ?? "Could not load PDF",
    );
  }
  if (!data?.signed_url) {
    throw new Error("PDF sign response missing signed_url");
  }
  return data.signed_url;
}

export function pdfJsViewerHtml(signedUrl: string, startPage = 1): string {
  // pdf.js viewer; minimal — single-column scroll + page memory.
  // The WebView's CSP allows fetching from Supabase Storage signed URLs
  // which already encode the auth via query.
  // JSON.stringify is the correct way to inject a JS string literal — it
  // handles any quote, backslash or unicode escape needed inside <script>.
  const urlLiteral = JSON.stringify(signedUrl);
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=yes,maximum-scale=4">
<style>
  html,body{margin:0;background:#111;color:#eee;font-family:-apple-system,system-ui,sans-serif;}
  body{min-height:100vh;}
  .page{display:block;margin:14px auto;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.3);max-width:100%;}
  #spinner{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:14px;background:#111;z-index:10;}
  #err{position:fixed;inset:0;display:none;align-items:center;justify-content:center;color:#fda4af;font-size:14px;padding:24px;text-align:center;background:#111;z-index:10;}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
</head><body>
<div id="spinner">Loading PDF…</div>
<div id="err"></div>
<script>
(function(){
  if(!window.pdfjsLib){document.getElementById('err').style.display='flex';document.getElementById('err').textContent='Could not load PDF engine.';return;}
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var url=${urlLiteral};
  var startPage=${startPage|0};
  var post=function(t,p){try{window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({t:t},p||{})))}catch(_){}}
  var pages=[];
  var current=startPage;
  var total=0;
  pdfjsLib.getDocument({url:url, disableAutoFetch:true, disableStream:false}).promise.then(function(pdf){
    total=pdf.numPages;
    post('total',{total:total});
    var dpr=Math.min(window.devicePixelRatio||1, 2);
    function renderPage(n){
      return pdf.getPage(n).then(function(p){
        var unscaled=p.getViewport({scale:1});
        var vw=document.documentElement.clientWidth;
        var scale=Math.min(2, Math.max(0.5, (vw-16)/unscaled.width));
        var v=p.getViewport({scale:scale});
        var c=document.createElement('canvas');
        c.className='page';
        c.width=Math.floor(v.width*dpr);
        c.height=Math.floor(v.height*dpr);
        c.style.width=v.width+'px';
        c.style.height=v.height+'px';
        var ctx=c.getContext('2d');
        ctx.scale(dpr,dpr);
        document.body.appendChild(c);
        pages.push(c);
        return p.render({canvasContext:ctx, viewport:v}).promise;
      });
    }
    var chain=Promise.resolve();
    for(var i=1;i<=total;i++){ (function(n){chain=chain.then(function(){return renderPage(n);}); })(i); }
    chain.then(function(){
      document.getElementById('spinner').style.display='none';
      post('loaded',{total:total});
      setTimeout(function(){
        var target=pages[Math.min(Math.max(1,startPage),total)-1];
        if(target) target.scrollIntoView({block:'start'});
      },80);
      var lastReported=startPage;
      function detect(){
        var midY=window.scrollY + window.innerHeight*0.35;
        var best=1;
        for(var i=0;i<pages.length;i++){
          var top=pages[i].offsetTop;
          if(top<=midY) best=i+1;
        }
        if(best!==lastReported){
          lastReported=best; current=best;
          post('pageChange',{page:best});
        }
      }
      window.addEventListener('scroll', function(){ requestAnimationFrame(detect); }, {passive:true});
    }).catch(function(e){
      document.getElementById('spinner').style.display='none';
      document.getElementById('err').textContent='Failed to render PDF: '+e.message;
      document.getElementById('err').style.display='flex';
      post('error',{message:e.message});
    });
  }).catch(function(e){
    document.getElementById('spinner').style.display='none';
    document.getElementById('err').textContent='Could not open PDF.';
    document.getElementById('err').style.display='flex';
    post('error',{message:e.message});
  });
  window.__goPage=function(n){
    var idx=Math.min(Math.max(1,n|0), total||1);
    var target=pages[idx-1];
    if(target) target.scrollIntoView({block:'start', behavior:'smooth'});
  };
})();
</script>
</body></html>`;
}
