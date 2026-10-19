// Hosted V2 panel shares its reviewed source with the Windows loopback kit.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto')
const base=path.resolve(__dirname,'..'),root=path.resolve(base,'..')
const source=path.join(base,'engineering/structural_engine/sap2000_v2/panel.html')
const dest=path.join(base,'frontend/vue/public/sap2000-api/26.2.0')
fs.mkdirSync(dest,{recursive:true})
if(fs.existsSync(source)){
 let html=fs.readFileSync(source,'utf8').replace('<title>','<meta name="sap2000-connector" content="http://127.0.0.1:8010"><meta name="referrer" content="no-referrer">\n<title>')
 html=html.replace('</details></section></fieldset>',`<p>SAP2000-API V2: <a href="API_IF_SAP26.2.0_V2.zip" download>Download Windows connector V2</a>. Extract to C:\\geek_calculus\\SAP2000-API. Stop the old connector and run install-web-launcher.cmd once to upgrade to V2. Then click SAP2000-API on GeekCalculus and approve the browser / Administrator prompts. Allow local-network access if requested.</p></details></section></fieldset>`)
 fs.writeFileSync(path.join(dest,'index.html'),html)
}else if(!fs.readFileSync(path.join(dest,'index.html'),'utf8').includes('/API_IF_SAP26.2.0_V2'))throw Error('Missing V2 panel source/static asset')
const kit=path.join(root,'downloads/API_IF_SAP26.2.0_V2.zip'),published=path.join(dest,'API_IF_SAP26.2.0_V2.zip')
if(fs.existsSync(kit))fs.copyFileSync(kit,published)
if(!fs.existsSync(published))throw Error('Missing clean SAP2000 V2 Windows kit')
const handoff=path.join(base,'engineering/structural_engine/sap2000_v2/design_handoff.mjs');if(fs.existsSync(handoff))fs.copyFileSync(handoff,path.join(dest,'design_handoff.mjs'));if(!fs.existsSync(path.join(dest,'design_handoff.mjs')))throw Error('Missing design handoff module')
const componentAssets=JSON.parse(fs.readFileSync(path.join(base,'engineering/structural_engine/sap2000_v2/steel_component_assets.json'),'utf8'));fs.mkdirSync(path.join(dest,'steel_component'),{recursive:true});for(const name of componentAssets)fs.copyFileSync(path.join(base,'frontend/vue/public',name),path.join(dest,'steel_component',name));
const old=path.join(dest,'API_IF_SAP26.2.0_V1.zip');if(fs.existsSync(old))fs.unlinkSync(old)
const html=fs.readFileSync(path.join(dest,'index.html'),'utf8')
const manifest={sap2000_version:'26.2.0',api_name:'API_IF_SAP26.2.0_V2',build_id:html.match(/build (2026\.[\w.-]+)/)?.[1],distribution_sha256:crypto.createHash('sha256').update(fs.readFileSync(published)).digest('hex'),panel_layout:'Shared V2 package source and CSS',transport:'authenticated loopback Windows connector',local_root:'C:\\geek_calculus\\SAP2000-API'}
fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
console.log('SAP2000 26.2.0 V2 hosted panel and Windows kit ready.')
