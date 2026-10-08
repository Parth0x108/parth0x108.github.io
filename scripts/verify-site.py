#!/usr/bin/env python3
"""Check the self-contained static portfolio before a GitHub Pages upload."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit,unquote
import json,re,struct,sys,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]/'dist'
routes={'/':'index.html','/work/':'work/index.html','/bounties/':'bounties/index.html','/writing/':'writing/index.html'}
domain='https://parth0x108.github.io'
class Page(HTMLParser):
 def __init__(self):
  super().__init__();self.tags=[];self.ids=[];self.links=[];self.title='';self.in_title=False;self.anchors=0
 def handle_starttag(self,tag,attrs):
  a=dict(attrs);self.tags.append((tag,a))
  if 'id' in a:self.ids.append(a['id'])
  if tag=='title':self.in_title=True
  if tag=='a':
   assert self.anchors==0,'Nested anchors';self.anchors+=1
  if tag in ('a','img','link','script'):
   value=a.get('href') or a.get('src')
   if value:self.links.append(value)
  if tag=='img':assert 'alt' in a,'Image missing alt'
  if tag=='button':assert a.get('type')=='button','Button missing type'
 def handle_endtag(self,tag):
  if tag=='title':self.in_title=False
  if tag=='a':self.anchors-=1
 def handle_data(self,s):
  if self.in_title:self.title+=s
builds=set();links=set()
for route,file in routes.items():
 s=(root/file).read_text();page=Page();page.feed(s)
 assert s.startswith('<!DOCTYPE html>')
 assert page.title=='Parth0x108',(file,page.title)
 assert len(page.ids)==len(set(page.ids)),f'{file}: duplicate ID'
 meta={a.get('name') or a.get('property'):a.get('content') for t,a in page.tags if t=='meta'}
 assert meta['viewport']=='width=device-width,initial-scale=1'
 assert meta['og:url']==domain+route
 assert meta['og:title']=='Parth0x108'
 assert meta['robots']=='index,follow'
 build=meta['portfolio-build'];builds.add(build)
 assert f'/style.css?v={build}' in page.links and f'/site.js?v={build}' in page.links
 assert any(t=='link' and a.get('rel')=='canonical' and a.get('href')==domain+route for t,a in page.tags)
 for t,a in page.tags:
  for key in ['aria-controls','aria-labelledby','aria-describedby']:
   if key in a:
    assert all(v in page.ids for v in a[key].split()),f'{file}: {key} target missing'
 links.update(page.links)
assert len(builds)==1,'Mixed cache build versions'
for value in links:
 url=urlsplit(value)
 if url.scheme or url.netloc:continue
 path=unquote(url.path)
 if not path:continue
 assert path.startswith('/'),f'Non-root asset or route: {value}'
 dest=root/path.lstrip('/')
 if path.endswith('/'):dest=dest/'index.html'
 assert dest.is_file(),f'Missing local destination: {value}'
css=(root/'style.css').read_text()
for value in re.findall(r'url\([\"\']?([^\)\"\']+)',css):
 if value.startswith('/'):
  assert (root/value.lstrip('/')).is_file(),f'Missing CSS asset {value}'
for filename,size in [('favicon-16x16.png',16),('favicon-32x32.png',32),('favicon-48x48.png',48),('apple-touch-icon.png',180),('android-chrome-192x192.png',192),('android-chrome-512x512.png',512)]:
 b=(root/filename).read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n';assert struct.unpack('>II',b[16:24])==(size,size)
assert (root/'favicon.ico').read_bytes()[:4]==b'\0\0\1\0'
manifest=json.loads((root/'site.webmanifest').read_text());assert manifest['name']=='Parth0x108';assert manifest['start_url']=='/'
for icon in manifest['icons']:assert (root/icon['src'].lstrip('/')).is_file()
assert (root/'.nojekyll').is_file() and (root/'404.html').is_file()
sitemap=ET.parse(root/'sitemap.xml');assert {x.text for x in sitemap.findall('.//{*}loc')}=={domain+r for r in routes}
assert 'Allow: /' in (root/'robots.txt').read_text()
assert not re.search(r'chatgpt\.site|localhost|127\.0\.0\.1',''.join((root/f).read_text() for f in routes.values())), 'Development URLs in deployed markup'
print(f'Build {next(iter(builds))}: four pages, titles, canonical routes, local assets, accessibility references, favicons, manifest, sitemap, and 404 verified.')
