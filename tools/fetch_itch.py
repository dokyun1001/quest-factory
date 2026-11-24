import sys, re, json, http.cookiejar, urllib.request, urllib.parse, os
page, outdir, want = sys.argv[1].rstrip('/'), sys.argv[2], sys.argv[3:]
cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj)); op.addheaders=[('User-Agent','Mozilla/5.0')]
def csrf_of(t): return (re.search(r'csrf_token" value="([^"]+)"',t) or re.search(r'csrf_token":"([^"]+)"',t)).group(1)
t=op.open(page).read().decode(); csrf=csrf_of(t)
ups=re.findall(r'data-upload_id="(\d+)"',t)
if not ups:  # purchase-gated: go via download page
    j=json.loads(op.open(page+'/download_url',urllib.parse.urlencode({'csrf_token':csrf}).encode()).read())
    t=op.open(j['url']).read().decode(); csrf=csrf_of(t)
key=None
m=re.search(r'/download/([^"?#]+)', t)
pairs=re.findall(r'data-upload_id="(\d+)".*?class="upload_name".*?title="([^"]+)"', t, re.S)
for uid,name in pairs:
    if want and not any(w in name for w in want): continue
    j=json.loads(op.open(f'{page}/file/{uid}?source=game_download',urllib.parse.urlencode({'csrf_token':csrf}).encode()).read())
    if 'url' not in j: print(name,'ERR',j); continue
    for a in range(3):
        try:
            d=op.open(j['url'],timeout=120).read(); open(os.path.join(outdir,name),'wb').write(d); print(name,'saved',len(d)); break
        except Exception as e: print(name,'retry',e)
