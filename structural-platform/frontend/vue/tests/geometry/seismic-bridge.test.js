import test from 'node:test'
import assert from 'node:assert/strict'
import { bridgeField, bridgeRequest } from '../../src/seismic-bridge.mjs'

test('SAP runtime field names preserve case-insensitive columns and wrappers',()=>{
 assert.deepEqual(bridgeField({data:{TableKey:['Mass Source Definitions']}},'tablekey'),['Mass Source Definitions'])
 assert.deepEqual(bridgeField({data:{TableKey:{value:['Base Reactions']}}},'tablekey'),['Base Reactions'])
 assert.equal(bridgeField({status:'unsupported'},'TableKey'),undefined)
})
test('bridge only sends bearer credentials to an explicit loopback origin',async()=>{
 for(const url of ['https://example.com','http://127.0.0.1.evil.test','http://localhost/path','http://localhost/?x=1','http://u:p@localhost']) await assert.rejects(bridgeRequest(url,'x'.repeat(32),'/model'),/local SAP2000/)
 await assert.rejects(bridgeRequest('http://localhost:8010','','/model'),/bearer token/)
})
test('bridge sends original model identity and rejects unavailable connector',async()=>{
 const original=globalThis.fetch
 try {
  globalThis.fetch=async(url,options)=>{assert.equal(url,'http://127.0.0.1:8010/API_IF_SAP26.2.0_V2/table');assert.equal(options.headers.Authorization,`Bearer ${'a'.repeat(32)}`);assert.equal(JSON.parse(options.body).expected_model,'test.sdb');return {ok:true,json:async()=>({model:'test.sdb',rows:[]})}}
  const value=await bridgeRequest('http://127.0.0.1:8010','a'.repeat(32),'/table',{expected_model:'test.sdb'});assert.equal(value.model,'test.sdb')
  globalThis.fetch=async()=>({ok:false,status:503,json:async()=>({detail:'SAP unavailable'})})
  await assert.rejects(bridgeRequest('http://127.0.0.1:8010','a'.repeat(32),'/model'),/SAP unavailable/)
 } finally {globalThis.fetch=original}
})
