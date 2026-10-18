// Versioned static panel, sourced from the reviewed Windows kit; never copy .venv.
const fs=require('node:fs'),path=require('node:path')
const base=path.resolve(__dirname,'..'),root=path.resolve(base,'..')
const source=path.join(base,'engineering/structural_engine/member_forces/panel.html')
const dest=path.join(base,'frontend/vue/public/sap2000-api/26.2.0')
fs.mkdirSync(dest,{recursive:true})
if(fs.existsSync(source)){
 let html=fs.readFileSync(source,'utf8').replace('<title>', '<meta name="sap2000-connector" content="http://127.0.0.1:8010"><meta name="referrer" content="no-referrer">\n<title>')
 html=html.replace('</details></section></fieldset>',`<p>Windows connector: <a href="API_IF_SAP26.2.0_V1.zip" download>Download SAP2000 26.2.0 API kit</a>. Extract to C:\\geek_calculus\\SAP2000-API and run install-web-launcher.cmd once on each Windows device. Then click SAP2000-API on GeekCalculus and approve the browser / Administrator prompts. The launcher opens this panel with a local token. Browser local-network permission may be required.</p></details></section></fieldset>`)
 fs.writeFileSync(path.join(dest,'index.html'),html)
}else if(!fs.existsSync(path.join(dest,'index.html')))throw Error('Missing SAP2000 panel source/static asset')
const kit=path.join(root,'downloads/API_IF_SAP26.2.0_V1.zip')
if(fs.existsSync(kit))fs.copyFileSync(kit,path.join(dest,'API_IF_SAP26.2.0_V1.zip'))
if(!fs.existsSync(path.join(dest,'API_IF_SAP26.2.0_V1.zip')))throw Error('Missing clean SAP2000 Windows kit')
const manifest=path.join(dest,'manifest.json')
if(fs.existsSync(manifest)){const data=JSON.parse(fs.readFileSync(manifest,'utf8'));data.distribution_sha256=require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(dest,'API_IF_SAP26.2.0_V1.zip'))).digest('hex');fs.writeFileSync(manifest,JSON.stringify(data,null,2)+'\n')}
console.log('SAP2000 26.2.0 web panel and source-only Windows kit ready.')
