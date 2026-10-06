// Run with Node 22: node scripts/test-chat-feed-sync.cjs
// Exercises the actual providers/hooks with controlled React effects and Firestore delivery order.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const tick = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; };

function harness(stubs) {
  const states=[], refs=[], dependencies=[], cleanups=[];
  let stateIndex=0, refIndex=0, effectIndex=0;
  const effects=[];
  const react = {
    createContext: () => ({ Provider: 'Provider' }), useContext: () => null,
    useState(initial) { const i=stateIndex++; if (!(i in states)) states[i]=initial; return [states[i], value => { states[i]=typeof value==='function' ? value(states[i]) : value; }]; },
    useRef(initial) { const i=refIndex++; return refs[i] ||= { current: initial }; },
    useCallback: fn => fn,
    useEffect(fn, deps) { const i=effectIndex++; if (!dependencies[i] || deps.some((v,j)=>!Object.is(v,dependencies[i][j]))) { dependencies[i]=deps; effects.push(() => { cleanups[i]?.(); cleanups[i]=fn(); }); } },
  };
  function load(file) {
    const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop:true, target:ts.ScriptTarget.ES2022 } }).outputText;
    const module={exports:{}};
    vm.runInNewContext(code, { module, exports:module.exports, console:{error:()=>{}}, localStorage:stubs.localStorage,
      require(id) { if(id==='react') return react; if(id==='react/jsx-runtime') return { jsx:(type,props)=>({type,props}) }; if(id in stubs) return stubs[id]; throw Error('Unexpected dependency '+id); } }, { filename:file });
    return module.exports;
  }
  return { load, render(fn) { stateIndex=refIndex=effectIndex=0; const result=fn(); while(effects.length) effects.shift()(); return result; }, close() { cleanups.forEach(fn=>fn?.()); } };
}

test('cached chats render before metadata; newer snapshots win; errors preserve cache; account changes isolate listeners', async () => {
  const metadata=deferred();
  const stamp={toMillis:()=>100};
  const old={id:'old',activityId:'activity',participantIds:['one'],createdAt:stamp};
  let uid='one';
  const listeners=[];
  const cache=new Map([['old',old]]);
  const removed=[];
  const h=harness({
    '@/hooks/use-auth':{useAuth:()=>({user:{uid},userProfile:{}})}, '@/lib/firebase/client':{db:{}},
    'firebase/firestore':{collection:()=>({}),doc:(_,collection,id)=>({collection,id}), query:()=>({}),where:()=>({}),
      getDoc:()=>metadata.promise, onSnapshot:(_,options,success,error)=>{ const listener={success,error,closed:false}; listeners.push(listener); return ()=>listener.closed=true; }},
    '@/lib/chat-activity-metadata':{hydrateActivityChatMetadata:async(chat,fetch)=>chat.placeName ? chat : {...chat,placeName:(await fetch(chat.activityId))?.placeName}},
    '@/lib/db/indexed-db':{getCachedChats:async()=>[...cache.values()],upsertCachedChats:async(_,chats)=>chats.forEach(c=>cache.set(c.id,c)),deleteCachedChat:async(_,id)=>{cache.delete(id);removed.push(id);},clearCachedMessagesForChat:async()=>{},deleteCachedActivity:async()=>{}},
  });
  const {ChatSyncProvider}=h.load('src/contexts/chat-sync-context.tsx');
  const read=()=>h.render(()=>ChatSyncProvider({children:null})).props.value;
  read(); assert.equal(listeners.length,1,'listener starts without awaiting the cache');
  await tick(); assert.equal(read().chats[0].id,'old'); assert.equal(read().loading,false);
  const snapshot=chats=>({docs:chats.map(chat=>({id:chat.id,data:()=>chat})),empty:!chats.length,metadata:{fromCache:false}});
  listeners[0].success(snapshot([old]));
  const latest={id:'latest',placeName:'Current',activityId:'new',participantIds:['one'],createdAt:stamp};
  listeners[0].success(snapshot([latest])); await tick();
  assert.equal(read().chats[0].id,'latest');
  metadata.resolve({exists:()=>true,data:()=>({placeName:'Outdated'})}); await tick();
  assert.equal(read().chats[0].id,'latest','late metadata cannot restore the older room');
  assert.deepEqual([...cache.keys()],['latest']); assert.ok(removed.includes('old'));
  listeners[0].error(new Error('Unavailable')); assert.equal(read().chats[0].id,'latest'); assert.equal(read().error.message,'Unavailable');
  uid='two'; read(); assert.equal(listeners[0].closed,true); assert.equal(read().chats.length,0);
  listeners[0].success(snapshot([old])); assert.equal(read().chats.length,0,'late events from previous account are ignored');
  h.close();
});

test('existing account preferences take precedence over a stale browser-only migration', async () => {
  let listener;
  let writes=0;
  const storage=new Map([['activa-hidden-feed-categories:one','["food"]']]);
  const h=harness({localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,v)=>storage.set(key,v)},
    '@/lib/firebase/client':{db:{}}, 'firebase/firestore':{doc:()=>({}),onSnapshot:(_,options,fn)=>{listener=fn;return()=>{};},updateDoc:async()=>{writes++;}},
    '@/lib/feed-category-visibility':{parseHiddenFeedCategories:raw=>JSON.parse(raw)},
    '@/lib/feed-preferences':{normalizeFeedPreferences:input=>({sortBy:input?.sortBy==='distance'?'distance':'recommended',hiddenCategoryIds:input?.hiddenCategoryIds||[]})},
  });
  const {useFeedCategoryVisibility}=h.load('src/hooks/use-feed-category-visibility.ts');
  const known=['food','religion'];const read=()=>h.render(()=>useFeedCategoryVisibility('one',known));
  read();
  listener({metadata:{fromCache:false,hasPendingWrites:false},data:()=>({feedPreferences:{sortBy:'distance',hiddenCategoryIds:['religion']}})});
  await tick();
  assert.equal(read().hiddenIds.join(','),'religion');assert.equal(read().sortBy,'distance');assert.equal(writes,0);
  h.close();
});

test('guest sorting remains functional and persists locally without accessing a user account', () => {
  const storage=new Map();
  const h=harness({localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,v)=>storage.set(key,v)},
    '@/lib/firebase/client':{db:{}}, 'firebase/firestore':{doc:()=>{throw Error('Guest must not access account data');}},
    '@/lib/feed-category-visibility':{parseHiddenFeedCategories:raw=>JSON.parse(raw)},
    '@/lib/feed-preferences':{normalizeFeedPreferences:input=>({sortBy:input?.sortBy==='distance'?'distance':'recommended',hiddenCategoryIds:input?.hiddenCategoryIds||[]})},
  });
  const {useFeedCategoryVisibility}=h.load('src/hooks/use-feed-category-visibility.ts');
  const known=['food'];const read=()=>h.render(()=>useFeedCategoryVisibility(undefined,known));
  read(); read().setSortBy('distance'); read().toggle('food');
  assert.equal(read().sortBy,'distance');assert.equal(read().hiddenIds.join(','),'food');
  const persisted=JSON.parse(storage.get('activa-feed-preferences:guest'));
  assert.equal(persisted.sortBy,'distance');assert.equal(persisted.pending.length,0);
  h.close();
});

test('feed preferences migrate once, use dotted writes, keep rapid changes, recover failure and isolate accounts', async () => {
  const storage=new Map([['activa-hidden-feed-categories:one','["food"]']]);
  const listeners=[], writes=[];
  const firestore={doc:(_,collection,id)=>({id}),onSnapshot:(ref,options,success)=>{listeners.push({ref,success});return()=>{};},updateDoc:(ref,patch)=>{const pending=deferred();writes.push({ref,patch,...pending});return pending.promise;}};
  const h=harness({localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,v)=>storage.set(key,v)},'firebase/firestore':firestore,'@/lib/firebase/client':{db:{}},
    '@/lib/feed-category-visibility':{parseHiddenFeedCategories:(raw,known)=>JSON.parse(raw).filter(id=>known.includes(id))},
    '@/lib/feed-preferences':{normalizeFeedPreferences:(input,known)=>({sortBy:input?.sortBy==='distance'?'distance':'recommended',hiddenCategoryIds:Array.isArray(input?.hiddenCategoryIds)?[...new Set(input.hiddenCategoryIds.filter(id=>known.includes(id)))]:[]})},
  });
  const {useFeedCategoryVisibility}=h.load('src/hooks/use-feed-category-visibility.ts');
  const known=['food','religion']; let uid='one';
  const read=()=>h.render(()=>useFeedCategoryVisibility(uid,known));
  read(); assert.equal(read().hiddenIds[0],'food');
  const server=(listener,value)=>listener.success({metadata:{fromCache:false,hasPendingWrites:false},data:()=>({feedPreferences:value})});
  server(listeners[0],{sortBy:'distance'}); await tick();
  assert.equal(read().sortBy,'distance'); assert.deepEqual(Object.keys(writes[0].patch),['feedPreferences.hiddenCategoryIds']);
  read().setSortBy('recommended'); read().toggle('religion');
  writes[0].resolve(); await tick();
  assert.equal(writes.length,2); assert.equal(writes[1].patch['feedPreferences.sortBy'],'recommended');
  assert.equal(writes[1].patch['feedPreferences.hiddenCategoryIds'].join(','),'food,religion');
  writes[1].reject(new Error('Offline')); await tick(); assert.equal(read().syncError,true);
  assert.ok(JSON.parse(storage.get('activa-feed-preferences:one')).pending.includes('sortBy'));
  read().retrySync(); read(); server(listeners[1],{sortBy:'distance',hiddenCategoryIds:[]}); await tick();
  assert.equal(read().sortBy,'recommended','pending local choice wins until acknowledged');
  writes[2].resolve(); await tick(); assert.equal(read().syncError,false);
  server(listeners[1],{sortBy:'distance',hiddenCategoryIds:['religion']});
  assert.equal(read().sortBy,'distance'); assert.equal(read().hiddenIds.join(','),'religion','remote account changes update this device');
  uid='two'; read(); assert.equal(read().hiddenIds.length,0); assert.equal(read().sortBy,'recommended');
  h.close();
});
