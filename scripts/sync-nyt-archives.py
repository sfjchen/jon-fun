"""Fetch published, exact-date NYT puzzles using normal public endpoints; resume safely.
Usage: python3 scripts/sync-nyt-archives.py --through YYYY-MM-DD [--games fivefold bee mini connections]
No credentials, authentication bypass headers, or future puzzles are used.
"""
import argparse,concurrent.futures,datetime,hashlib,json,subprocess,time
from pathlib import Path
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parents[1]
START={'fivefold':'2021-06-19','bee':'2018-05-06','mini':'2014-08-21','connections':'2023-06-12'}
PATH={'fivefold':'wordle/v2','bee':'spelling-bee/v1','mini':'crosswords/v6/puzzle/mini','connections':'connections/v2'}
def normalize(game,d,date):
 assert d.get('print_date',d.get('publicationDate'))==date,'Wrong source date'
 if game=='fivefold':
  answer=d['solution'].lower();assert len(answer)==5 and answer.isascii() and answer.isalpha()
  return dict(date=date,answer=answer,id=d['id'],number=d['days_since_launch'],editor=d.get('editor',''))
 if game=='bee':
  center=d.get('center_letter',d.get('centerLetter'));outer=list(d.get('outer_letters',d.get('outerLetters',[])));letters=center+''.join(outer);answers=sorted(set(d['answers'])|set(d['pangrams']))
  assert len(set(letters))==7 and len(outer)==6 and answers and all(len(w)>=4 and center in w and set(w)<=set(letters)for w in answers),'Published answers conflict with hive letters or center';assert len(d['pangrams'])==sum(len(set(w))==7 for w in answers),'Incomplete pangrams'
  return dict(date=date,id=letters,center=center,outer=outer,answers=answers,pangrams=[w for w in answers if len(set(w))==7],max=sum((1 if len(w)==4 else len(w))+(7 if len(set(w))==7 else 0)for w in answers))
 if game=='mini':
  b=d['body'][0];width,height=b['dimensions']['width'],b['dimensions']['height'];cells=[c.get('answer')or None for c in b['cells']];assert len(cells)==width*height and any(cells)
  clues=[dict(number=str(c['label']),direction=c['direction'],text=''.join(t.get('plain','')for t in c['text']),cells=c['cells'],answer=''.join(cells[i]for i in c['cells']))for c in b['clues']]
  assert clues and all(c['cells']and c['direction']in ['Across','Down']for c in clues)
  return dict(date=date,id=d['id'],constructors=d.get('constructors',[]),editor=d.get('editor',''),copyright=d.get('copyright',''),width=width,height=height,cells=cells,clues=clues)
 cats=d['categories'];assert len(cats)==4 and all(len(c['cards'])==4 for c in cats)
 words=[w.get('content') or w.get('image_alt_text') for c in cats for w in c['cards']];assert len(set(words))==16 and all(isinstance(w,str)and w.strip()for w in words),'Unsupported visual puzzle'
 slug='nyt-archive-'+date
 return dict(date=date,id=slug,slug=slug,version=1,title='Connections · '+date,description='Original NYT puzzle for '+date,groups=[dict(category=c['title'],difficulty=['yellow','green','blue','purple'][i],words=[w.get('content') or w['image_alt_text'] for w in c['cards']])for i,c in enumerate(cats)],tileImages={w['image_alt_text']:{'url':w['image_url'],'alt':w['image_alt_text']}for c in cats for w in c['cards']if 'image_url'in w},startingWords=[w.get('content') or w['image_alt_text'] for w in sorted([w for c in cats for w in c['cards']],key=lambda w:w['position'])],difficultyKnown=True,tags=['nyt',date],authorDisplay='The New York Times',authorFingerprint='',createdAt=date+'T00:00:00Z',updatedAt=date+'T00:00:00Z')
def write(p,d):
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n')
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--verify-existing',action='store_true');ap.add_argument('--through',default=datetime.datetime.now(ZoneInfo('America/Los_Angeles')).date().isoformat());ap.add_argument('--games',nargs='+',choices=list(START),default=list(START));a=ap.parse_args();assert a.through<=datetime.datetime.now(ZoneInfo('America/Los_Angeles')).date().isoformat()
 cache=Path('/tmp/nyt-sfjc/archive');cache.mkdir(parents=True,exist_ok=True)
 manifest_path=ROOT/'public/puzzle-archives/manifest.json';manifest=json.loads(manifest_path.read_text())
 for game in a.games:
  folder=ROOT/'public/puzzle-archives'/game;games={}
  if folder.exists():
   for p in folder.glob('[0-9][0-9][0-9][0-9].json'):
    for g in json.loads(p.read_text()):games[g['date']]=g
  dates=[];d=datetime.date.fromisoformat(START[game]);last=datetime.date.fromisoformat(a.through)
  while d<=last:
   date=d.isoformat()
   if a.verify_existing or date not in games or date>=a.through:dates.append(date)
   d+=datetime.timedelta(days=1)
  def get(date):
   p=cache/f'{game}-{date}.json';url=f'https://www.nytimes.com/svc/{PATH[game]}/{date}.json'
   try:
    if not p.exists():
     temp=p.with_suffix('.download');r=subprocess.run(['curl','-sS','--retry','2','--retry-delay','1','--max-time','25','-o',str(temp),'-w','%{http_code}',url],capture_output=True,text=True)
     if r.returncode or r.stdout!='200':return date,None,'HTTP '+r.stdout
     temp.replace(p)
    raw=json.loads(p.read_text());return date,normalize(game,raw,date),None
   except Exception as e:return date,None,str(e)
  failures=[]
  with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:
   for i,(date,puzzle,error)in enumerate(pool.map(get,dates)):
    if puzzle:games[date]=puzzle
    else:failures.append({'date':date,'reason':error})
    if (i+1)%200==0:print(game,i+1,'/',len(dates),flush=True)
  years={}
  for date,puzzle in sorted(games.items()):
   if date<=a.through:years.setdefault(date[:4],[]).append(puzzle)
  for year,batch in years.items():write(folder/(year+'.json'),batch)
  allgames=[p for batch in years.values()for p in batch];write(folder/'index.json',[p['date']for p in allgames])
  words=sorted({w for p in allgames for w in ([p['answer']]if game=='fivefold'else p.get('answers',[])or[c['answer']for c in p.get('clues',[])]or[w for g in p.get('groups',[])for w in g['words']])});write(folder/'words.json',words)
  manifest['sources'][game]=dict(url='https://www.nytimes.com/svc/'+PATH[game]+'/YYYY-MM-DD.json',puzzles=len(allgames),uniqueWords=len(words),firstDate=allgames[0]['date'],lastDate=allgames[-1]['date'],checkedThrough=a.through,missingDates=failures,normalizedSha256=hashlib.sha256(json.dumps(allgames,sort_keys=True).encode()).hexdigest());write(manifest_path,manifest)
  print(game,len(allgames),'puzzles;',len(failures),'unavailable dates',flush=True)
if __name__=='__main__':main()
