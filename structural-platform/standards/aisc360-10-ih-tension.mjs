/** AISC 360-10 B4.3b / D2 / D3 / F13.1 / H4, SI units.
 * Holes are ROUND nominal-hole dimensions, not bolt diameters. The user must
 * identify the critical straight path; staggered/slot geometry is never inferred.
 */
export const TENSION_SOURCE = Object.freeze({
  edition:'AISC360-10', sha256:'f9b15004cf51dbaec6c06588d81aa5256be268af87906e5ba863c289795f4e99',
  physical_pages:[74,82,83,84,120,135,136], printed_pages:['16.1-18','16.1-26','16.1-27','16.1-28','16.1-64','16.1-79','16.1-80'],
});
export const TENSION_FORMULAS = Object.freeze({
  'B4.3b':{clause:'B4.3b',expression:'An = Ag − Σ n(dh+2 mm)t (critical straight path)',applies:'round holes; all critical paths confirmed; no stagger/slots'},
  'D2-1':{clause:'D2-1',expression:'Pn = Fy Ag; φt=0.90, Ωt=1.67',applies:'gross-section tensile yielding'},
  'D2-2':{clause:'D2-2',expression:'Pn = Fu Ae; φt=0.75, Ωt=2.00',applies:'net-section tensile rupture'},
  'D3-1':{clause:'D3-1 / Table D3.1 cases 1,2',expression:'Ae = U An; U=1 (all elements); U=max(1−x̄/l,Ag,connected/Ag) (case 2)',applies:'direct all-element or partial longitudinal load transfer to open I/H; explicit connection geometry'},
  'F13-1':{clause:'F13.1 / F13-1',expression:'If Fu Afn < Yt Fy Afg: Mn ≤ Fu Afn Sx/Afg; Yt=1 for Fy/Fu≤0.8, else 1.1',applies:'tension flange with holes; no shear-lag U in flange bending reduction'},
  'H4-1':{clause:'H4-1',expression:'Pr/Pc + Mrx/Mcx ≤ 1.0 (signed, each tension flange)',applies:'combined axial force and major-axis flexure at flange holes; minor-axis hole interaction requires separate review'},
});
const missing=(id,reason,clause='B4.3b/D2/D3')=>({id,status:'INPUT_REQUIRED',reason,clause,source:TENSION_SOURCE});
const review=(id,reason,clause)=>({...missing(id,reason,clause),status:'REVIEW_REQUIRED'});
const finitePositive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
const none=(id,reason,clause)=>({id,status:'NOT_APPLICABLE',reason,clause,source:TENSION_SOURCE});
const atPages=(...pages)=>({...TENSION_SOURCE,physical_pages:pages,printed_pages:pages.map(p=>'16.1-'+(p-56))});

export function calculateIHNetSection(input,canonical) {
  const id='NET_SECTION', h=input.holes;
  if(!h || h.critical_path_confirmed!==true) return missing(id,'Declare round-hole counts at the critical section and confirm all possible net-section paths were considered.');
  if(h.pattern!=='STRAIGHT') return review(id,'Staggered paths and slots require pitch, gage, slot orientation and explicit critical-path evaluation; simple hole counts cannot establish An.','B4.3b');
  const s=input.section, hw=s.h_mm-2*s.tf_mm, ag=canonical.area_mm2;
  if(!finitePositive(ag)||!finitePositive(hw))return missing(id,'Valid canonical gross area and clear web geometry are required.');
  const counts=[h.top_flange_count,h.bottom_flange_count,h.web_count];
  if(counts.some(v=>!Number.isInteger(v)||v<0))return missing(id,'Hole counts must be explicit nonnegative integers; blank is not zero.');
  const [nt,nb,nw]=counts, df=h.flange_hole_diameter_mm,dw=h.web_hole_diameter_mm;
  if(((nt+nb)>0&&!finitePositive(df)) || (nw>0&&!finitePositive(dw)))return missing(id,'Supply nominal round-hole diameters in mm. B4.3b adds 2 mm to each hole dimension.');
  const top=nt ? nt*(df+2)*s.tf_mm : 0, bottom=nb ? nb*(df+2)*s.tf_mm : 0, web=nw ? nw*(dw+2)*s.tw_mm : 0;
  const afg=s.bf_mm*s.tf_mm, an=ag-top-bottom-web;
  if(afg-top<=0 || afg-bottom<=0 || hw*s.tw_mm-web<=0 || !finitePositive(an))return missing(id,'Hole deductions exhaust a plate width or the gross section. Check counts, diameters and the selected path.');
  return {id,status:'CALCULATED',nominal:an,unit:'mm²',clause:'B4.3b',source:atPages(74),
    gross_area_mm2:ag,net_area_mm2:an,flange_gross_area_mm2:afg,
    flange_net_areas_mm2:{top:afg-top,bottom:afg-bottom},counts:{top:nt,bottom:nb,web:nw},
    trace:{deduction_allowance_mm:2,removed_area_mm2:top+bottom+web,top_removed_mm2:top,bottom_removed_mm2:bottom,web_removed_mm2:web,
      path:'User-confirmed critical straight transverse path; no stagger credit'}};
}

export function calculateIHTension(input,canonical,factors,net=calculateIHNetSection(input,canonical)) {
  const id='TENSION', fy=input.material.fy_mpa,fu=input.material.fu_mpa;
  if(!finitePositive(fu)||fu<fy)return missing(id,'Supply specified Fu ≥ Fy in MPa for D2 net-section rupture.');
  if(net.status!=='CALCULATED')return {...net,id};
  const c=input.tension_connection;
  let u,caseId,connectedArea=net.gross_area_mm2;
  if(c?.load_transfer==='ALL_ELEMENTS') {u=1;caseId=1;}
  else if(c?.load_transfer==='PARTIAL_LONGITUDINAL') {
    const elements=c.connected_elements;
    if(!Array.isArray(elements)||elements.length===0||elements.length>=3||new Set(elements).size!==elements.length||elements.some(x=>!['TOP','BOTTOM','WEB'].includes(x)))
      return missing(id,'Select the elements directly connected by fasteners/longitudinal welds for Table D3.1 case 2.');
    if(!finitePositive(c.connection_length_mm)||typeof c.eccentricity_mm!=='number'||!Number.isFinite(c.eccentricity_mm)||c.eccentricity_mm<0)
      return missing(id,'Table D3.1 case 2 requires connection length l > 0 and connection eccentricity x̄ ≥ 0, in mm.');
    const plateAreas={TOP:net.flange_gross_area_mm2,BOTTOM:net.flange_gross_area_mm2,WEB:(input.section.h_mm-2*input.section.tf_mm)*input.section.tw_mm};
    connectedArea=elements.reduce((sum,x)=>sum+plateAreas[x],0);
    u=Math.min(1,Math.max(1-c.eccentricity_mm/c.connection_length_mm,connectedArea/net.gross_area_mm2));caseId=2;
  }else return missing(id,'Identify all-element load transfer (Table D3.1 case 1), or provide the partial longitudinal connection data for case 2. Unsupported connection types are not assigned U=1.');
  const ae=u*net.net_area_mm2, gross=fy*net.gross_area_mm2/1000, rupture=fu*ae/1000;
  const availableGross=factors.availableStrength(gross,input.method,'TENSION_GROSS');
  const availableRupture=factors.availableStrength(rupture,input.method,'TENSION_RUPTURE');
  const grossGoverns=availableGross<=availableRupture;
  return {id,status:'CALCULATED',nominal:grossGoverns?gross:rupture,available:Math.min(availableGross,availableRupture),unit:'kN',
    clause:'D2-1/D2-2/D3-1',source:atPages(82,83,84),
    trace:{ag_mm2:net.gross_area_mm2,an_mm2:net.net_area_mm2,ae_mm2:ae,u,shear_lag_case:caseId,connected_gross_area_mm2:connectedArea,
      gross_yield_nominal_kN:gross,rupture_nominal_kN:rupture,gross_yield_available_kN:availableGross,rupture_available_kN:availableRupture,
      governing:grossGoverns?'GROSS_YIELDING':'NET_RUPTURE',connection_design:'Fastener/weld/block-shear resistance is a separate connection check'}};
}

export function calculateIHFlangeHoles(input,canonical,factors,net,tension) {
  const id='FLANGE_HOLES',clause='F13.1/H4';
  if(net.status!=='CALCULATED')return {flexure:{...net,id},interaction:{...net,id:'FLANGE_HOLE_INTERACTION'}};
  if(net.counts.top+net.counts.bottom===0)return {flexure:none(id,'No flange holes declared.','F13.1'),interaction:none('FLANGE_HOLE_INTERACTION','No flange holes declared.','H4')};
  const {fy_mpa:fy,fu_mpa:fu}=input.material;
  if(!finitePositive(fu)||fu<fy){const e=missing(id,'Fu ≥ Fy is required to evaluate tension-flange holes.',clause);return {flexure:e,interaction:{...e,id:'FLANGE_HOLE_INTERACTION'}};}
  const yt=fy/fu<=.8?1:1.1,afg=net.flange_gross_area_mm2;
  const flanges=Object.entries(net.flange_net_areas_mm2).map(([flange,afn])=>{
    const applies=net.counts[flange]>0 && fu*afn<yt*fy*afg;
    const nominal=(applies?fu*afn/afg*canonical.sx_mm3:fy*canonical.zx_mm3)/1e6;
    return {flange,afn_mm2:afn,afg_mm2:afg,yt,rupture_applies:applies,nominal_kNm:nominal,available_kNm:factors.availableStrength(nominal,input.method,'FLEXURE')};
  });
  const mx=input.forces.moment_x_kNm,my=input.forces.moment_y_kNm,n=input.forces.axial_kN;
  const current=flanges.find(f=>f.flange===(mx>=0?'bottom':'top'));
  const flexure={id,status:'CALCULATED',nominal:current.nominal_kNm,available:current.available_kNm,unit:'kN·m',clause:'F13-1',source:atPages(120),
    trace:{flanges,tension_flange_for_bending:current.flange,positive_mx:'bottom flange in tension',u_not_used:true}};
  if(my!==0)return {flexure,interaction:review('FLANGE_HOLE_INTERACTION','H4-1 addresses axial force plus major-axis bending. Nonzero minor-axis moment at flange holes needs a separate net-section stress/interaction review.','H4')};
  const tensile=flanges.filter(f=>net.counts[f.flange]>0 && n*1000/net.gross_area_mm2+(f.flange==='bottom'?mx:-mx)*1e6/canonical.sx_mm3>0);
  if(tensile.length===0)return {flexure,interaction:none('FLANGE_HOLE_INTERACTION','No holed flange is in tension for the signed N/Mx at this section.','H4')};
  if(tension.status!=='CALCULATED')return {flexure,interaction:{...tension,id:'FLANGE_HOLE_INTERACTION',clause:'H4-1/D2-2'}};
  const pc=tension.trace.rupture_available_kN;
  const checks=tensile.map(f=>({...f,pr_kN:n,mrx_kNm:f.flange==='bottom'?mx:-mx,pc_kN:pc,
    utilization:n/pc+(f.flange==='bottom'?mx:-mx)/f.available_kNm}));
  const utilization=Math.max(...checks.map(f=>f.utilization));
  return {flexure,interaction:{id:'FLANGE_HOLE_INTERACTION',status:'CALCULATED',nominal:utilization,available:1,demand:utilization,unit:'ratio',clause:'H4-1',source:atPages(135,136),trace:{flanges:checks}}};
}
