/**
 * ANSI/AISC 360-10 reference calculation core for sharp-corner, doubly symmetric I/H.
 * Scope: B4.1a/b, E3/E4/E7, F1, F2/F3/F5/F6, H1.
 * F4 (noncompact web), D2/D3 net fracture, G shear/stiffeners are not silently approximated.
 * Units: mm, MPa, N, N.mm internally; input actions kN/kN.m.
 * Original source: ANSI/AISC 360-10 June 22, 2010 (specification, not commentary).
 */
export const REFERENCE = 'ANSI/AISC 360-10, June 22, 2010';
export const FORMULAS = Object.freeze({
  'B4.1a-1': {clause:'Table B4.1a case 1', expression:'λr,f = 0.56 sqrt(E/Fy)',applies:'rolled flange axial compression'},
  'B4.1a-2': {clause:'Table B4.1a case 2', expression:'λr,f = 0.64 sqrt(kc E/Fy)',applies:'built-up flange axial compression'},
  'B4.1a-5': {clause:'Table B4.1a case 5', expression:'λr,w = 1.49 sqrt(E/Fy)',applies:'web axial compression'},
  'B4.1b-10': {clause:'Table B4.1b case 10', expression:'λp,f = 0.38 sqrt(E/Fy); λr,f = 1.0 sqrt(E/Fy)',applies:'rolled flange major flexure'},
  'B4.1b-11': {clause:'Table B4.1b case 11', expression:'λp,f = 0.38 sqrt(E/Fy); λr,f = 0.95 sqrt(kc E/FL)',applies:'built-up flange major flexure; FL = 0.7 Fy for symmetric I'},
  'B4.1b-13': {clause:'Table B4.1b case 13',expression:'λp,f = 0.38 sqrt(E/Fy); λr,f = sqrt(E/Fy)',applies:'flange minor flexure'},
  'B4.1b-15': {clause:'Table B4.1b case 15',expression:'λp,w = 3.76 sqrt(E/Fy); λr,w = 5.70 sqrt(E/Fy)',applies:'I-shaped web flexure'},
  'E3-1': {clause:'E3-1',expression:'Pn = Fcr Ag',applies:'nonslender compression'},
  'E3-2': {clause:'E3-2',expression:'Fcr = (0.658^(Fy/Fe)) Fy when Fy/Fe ≤ 2.25',applies:'inelastic flexural buckling'},
  'E3-3': {clause:'E3-3',expression:'Fcr = 0.877 Fe when Fy/Fe > 2.25',applies:'elastic flexural buckling'},
  'E3-4': {clause:'E3-4',expression:'Fe = π² E / (KL/r)²',applies:'Euler buckling about each principal axis'},
  'E4-4': {clause:'E4-4',expression:'Fez = [π² E Cw/(Kz Lz)² + G J]/(Ix+Iy)',applies:'torsional buckling of doubly symmetric shapes'},
  'F1-1': {clause:'F1-1',expression:'Cb = 12.5 Mmax / (2.5 Mmax + 3 MA + 4 MB + 3 MC)',applies:'absolute-value moments within same unbraced segment; Cb=1 conservative default'},
  'F2-1': {clause:'F2-1',expression:'Mp = Fy Zx',applies:'major flexural yielding'},
  'F2-2': {clause:'F2-2',expression:'Mn = min(Mp, Cb[Mp -(Mp-0.7 Fy Sx)(Lb-Lp)/(Lr-Lp)])',applies:'inelastic LTB'},
  'F2-3': {clause:'F2-3',expression:'Mn = min(Mp,Fcr Sx)',applies:'elastic LTB'},
  'F2-4': {clause:'F2-4',expression:'Fcr = Cb π² E /(Lb/rts)² sqrt(1+0.078 J/(Sx ho)(Lb/rts)²)',applies:'elastic LTB'},
  'F2-5': {clause:'F2-5',expression:'Lp = 1.76 ry sqrt(E/Fy)',applies:'limit unbraced length, yielding'},
  'F2-6': {clause:'F2-6',expression:'Lr = 1.95 rts E/(0.7 Fy) sqrt(q+sqrt(q²+6.76(0.7 Fy/E)²)); q = J/(Sx ho)',applies:'limit unbraced length, inelastic LTB'},
  'F2-7': {clause:'F2-7',expression:'rts² = sqrt(Iy Cw)/Sx',applies:'warping-torsion effective radius'},
  'F3-1': {clause:'F3-1',expression:'Mn,FLB = Mp - (Mp-0.7 Fy Sx)(λf-λpf)/(λrf-λpf)',applies:'noncompact major-axis flange'},
  'F3-2': {clause:'F3-2',expression:'Mn,FLB = 0.9 E kc Sx/λf²',applies:'slender major-axis flange'},
  'E7-1': {clause:'E7-1',expression:'Pn = Fcr Ag; Q = Qs Qa',applies:'I-shaped compression members with slender elements'},
  'E7-2': {clause:'E7-2',expression:'Fcr = Q (0.658^(QFy/Fe)) Fy for QFy/Fe ≤ 2.25',applies:'inelastic buckling with slender elements'},
  'E7-3': {clause:'E7-3',expression:'Fcr = 0.877 Fe for QFy/Fe > 2.25',applies:'elastic buckling with slender elements'},
  'E7-4/E7-6': {clause:'E7-4–E7-6',expression:'Rolled flange Qs=1 / 1.415−0.74 λ sqrt(Fy/E) / 0.69 E/(Fy λ²)',applies:'rolled flange slender unstiffened element'},
  'E7-7/E7-9': {clause:'E7-7–E7-9',expression:'Built-up flange Qs=1 / 1.415−0.65 λ sqrt(Fy/(E kc)) / 0.90 E kc/(Fy λ²)',applies:'built-up flange slender unstiffened element'},
  'E7-16': {clause:'E7-16',expression:'Qa = Ae / Ag',applies:'stiffened slender web'},
  'E7-17': {clause:'E7-17',expression:'be = min(b, 1.92 t sqrt(E/f)[1−0.34 sqrt(E/f)/(b/t)]), f=Fcr at Q=1',applies:'uniformly compressed slender web'},
  'F4-7': {clause:'F4-7',expression:'Lp=1.1 rt sqrt(E/Fy)',applies:'slender-web F5 uses F4-7'},
  'F4-11': {clause:'F4-11',expression:'rt=bf/sqrt(12[ho/d + aw h²/(6 ho d)])',applies:'rectangular compression flange'},
  'F4-12': {clause:'F4-12',expression:'aw=hc tw/(bf tf)',applies:'web-to-flange area ratio'},
  'F5-1': {clause:'F5-1',expression:'Mn=Rpg Fy Sxc',applies:'slender web compression flange yielding'},
  'F5-2': {clause:'F5-2',expression:'Mn=Rpg Fcr Sxc',applies:'slender web lateral-torsional buckling'},
  'F5-3': {clause:'F5-3',expression:'Fcr=min(Fy,Cb[Fy−0.3Fy(Lb−Lp)/(Lr−Lp)])',applies:'slender web inelastic LTB'},
  'F5-4': {clause:'F5-4',expression:'Fcr=min(Fy,Cb π² E/(Lb/rt)²)',applies:'slender web elastic LTB'},
  'F5-5': {clause:'F5-5',expression:'Lr=πrt sqrt(E/(0.7Fy))',applies:'slender web LTB limit'},
  'F5-6': {clause:'F5-6',expression:'Rpg=min(1,1−aw/(1200+300aw)[hc/tw−5.7sqrt(E/Fy)])',applies:'slender web strength reduction'},
  'F5-7': {clause:'F5-7',expression:'Mn,FLB=Rpg Fcr Sxc',applies:'slender web flange local buckling'},
  'F5-8': {clause:'F5-8',expression:'Fcr=Fy−0.3Fy(λ−λpf)/(λrf−λpf)',applies:'slender web noncompact flange'},
  'F5-9': {clause:'F5-9',expression:'Fcr=0.9 E kc / λ²',applies:'slender web slender flange'},
  'F6-1': {clause:'F6-1',expression:'Mp,y = min(Fy Zy,1.6 Fy Sy)',applies:'minor-axis flexural yielding'},
  'F6-2': {clause:'F6-2',expression:'Mn,FLB = Mp,y -(Mp,y-0.7 Fy Sy)(λf-λpf)/(λrf-λpf)',applies:'noncompact flange minor bending'},
  'F6-3': {clause:'F6-3',expression:'Mn,FLB = Fcr Sy',applies:'slender flange minor bending'},
  'F6-4': {clause:'F6-4',expression:'Fcr = 0.69 E/λf²',applies:'slender flange minor bending'},
  'H1-1a': {clause:'H1-1a',expression:'η = Pr/Pc + 8/9(Mrx/Mcx + Mry/Mcy)',applies:'Pr/Pc ≥ 0.2'},
  'H1-1b': {clause:'H1-1b',expression:'η = Pr/(2Pc) + Mrx/Mcx + Mry/Mcy',applies:'Pr/Pc < 0.2'},
});
const positive = (v,n) => {if(typeof v!=='number'||!Number.isFinite(v)||v<=0)throw new RangeError(n+' must be positive finite');return v;};
const check = (v,n) => {if(typeof v!=='number'||!Number.isFinite(v))throw new RangeError(n+' must be finite');return v;};
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
const status = (id,code,reason,extra={}) => ({id,status:code,reason,...extra});
const value = (id,nominal,clause,trace={}) => ({id,status:'CALCULATED',nominal,clause,trace});
function available(nominal,method,key,factorLib){
 if(!factorLib || typeof factorLib.availableStrength!=='function') throw new Error('AISC360-10 resistance library required');
 return factorLib.availableStrength(nominal,method,key);
}
function classify(l,lp,lr){return l<=lp?'COMPACT':l<=lr?'NONCOMPACT':'SLENDER';}
function critical(fe,fy) {return fy/fe<=2.25?Math.pow(.658,fy/fe)*fy:.877*fe;}
/** Each station must belong to the SAME unbraced segment and consistent load case. */
export function cbF11(moment) {
 if(moment?.mode==='CONSERVATIVE') return {value:1,source:'CONSERVATIVE',clause:'F1-1 (Cb=1 conservative)'}
 if(moment?.mode!=='QUARTER_POINTS') return {value:null,source:'INPUT_REQUIRED',clause:'F1-1',reason:'Supply a verified segment moment diagram or choose Cb=1 conservative.'}
 if(moment.is_unbraced_cantilever) return {value:1,source:'F1-1 unbraced free end',clause:'F1-1'}
 if(moment.ends_braced!==true || moment.same_case!==true) return {value:null,source:'REVIEW_REQUIRED',clause:'F1-1',reason:'Both segment ends must be braced; all moment stations must come from one load case/combo.'}
 const moments=['mmax','ma','mb','mc'].map(k=>Math.abs(check(moment[k],k)));
 const [mmax,ma,mb,mc]=moments;
 const denom=2.5*mmax+3*ma+4*mb+3*mc;
 if(denom===0) return {value:1,source:'ZERO_MOMENT',clause:'F1-1'}
 if(mmax<Math.max(ma,mb,mc)) return {value:null,source:'REVIEW_REQUIRED',clause:'F1-1',reason:'Mmax is smaller than one of the quarter point magnitudes.'}
 return {value:12.5*mmax/denom,source:'SAME_SEGMENT_POINTS',clause:'F1-1',moments:{mmax,ma,mb,mc}};
}
export function classifyI(input) {
 const {section,material}=input;
 const h=positive(section.h_mm,'h'),bf=positive(section.bf_mm,'bf'),tw=positive(section.tw_mm,'tw'),tf=positive(section.tf_mm,'tf');
 const fy=positive(material.fy_mpa,'Fy'),e=positive(material.e_mpa,'E');
 if(h<=2*tf || bf<tw)throw new RangeError('Invalid I/H geometry');
 const fabrication=section.fabrication;
 if(!['BUILT_UP','ROLLED'].includes(fabrication)) throw new RangeError('Fabrication must be BUILT_UP or ROLLED');
 // For rolled profiles sharp-corner h is a conservative approximation: k and fillet need catalogue data.
 const hw=h-2*tf, lf=bf/(2*tf),lw=hw/tw, root=Math.sqrt(e/fy),kc=clamp(4/Math.sqrt(lw),.35,.76);
 const flangeCompressionLimit=(fabrication==='BUILT_UP'?.64*Math.sqrt(kc*e/fy):.56*root);
 const webCompressionLimit=1.49*root;
 const lp=.38*root, lrMajor=fabrication==='BUILT_UP'?.95*Math.sqrt(kc*e/(.7*fy)):root;
 const lrMinor=root, lpWeb=3.76*root, lrWeb=5.70*root;
 return {hw,lf,lw,kc,flangeCompressionLimit,webCompressionLimit,
  axialFlange:lf<=flangeCompressionLimit?'NONSLENDER':'SLENDER',
  axialWeb:lw<=webCompressionLimit?'NONSLENDER':'SLENDER',
  axial:lf<=flangeCompressionLimit&&lw<=webCompressionLimit?'NONSLENDER':'SLENDER',
  flexureFlange:classify(lf,lp,lrMajor),flexureWeb:classify(lw,lpWeb,lrWeb),
  minorFlange:classify(lf,lp,lrMinor),
  flexureChapter:lw>lpWeb?'F5':lf>lp?'F3':'F2',
  limits:{lpFlange:lp,lrMajorFlange:lrMajor,lrMinorFlange:lrMinor,lpWeb,lrWeb},
  clauses:['B4.1a-1','B4.1a-2','B4.1a-5','B4.1b-10','B4.1b-11','B4.1b-13','B4.1b-15'],
  geometry_model: fabrication==='ROLLED'?'SHARP_CORNER_ROLLED_APPROXIMATION':'BUILT_UP_RECTANGULAR_PLATES'
 };
}
/**
 * Canonical Section Properties object is required (no recalculation of Ix/J/Cw
 * in the AISC member engine). User supplies missing bracing and torsion inputs.
 */
export function calculateIH36010(input,canonical,factorLib) {
 if(!input || !canonical)throw new TypeError('Input and canonical Section Properties required');
 const method=input.method;
 if(method!=='ASD'&&method!=='LRFD')throw new RangeError('Expected ASD or LRFD');
 const {section,material,member={},forces={}}=input;
 const fy=positive(material.fy_mpa,'Fy'),e=positive(material.e_mpa,'E');
 const cls=classifyI(input);
 const area=positive(canonical.area_mm2,'A'),ix=positive(canonical.ix_mm4,'Ix'),iy=positive(canonical.iy_mm4,'Iy'),
  sx=positive(canonical.sx_mm3,'Sx'),sy=positive(canonical.sy_mm3,'Sy'),zx=positive(canonical.zx_mm3,'Zx'),
  zy=positive(canonical.zy_mm3,'Zy'),rx=positive(canonical.rx_mm,'rx'),ry=positive(canonical.ry_mm,'ry');
 const n=check(forces.axial_kN??0,'N'),mx=check(forces.moment_x_kNm??0,'Mx'),my=check(forces.moment_y_kNm??0,'My');
 const result={edition:'AISC360-10',mode:method,geometry_source:'Section Properties shared calculation core',
  geometry_hash:input.geometry_hash??null,classification:cls,limit_states:{},warnings:[],overall_status:'REVIEW_REQUIRED'};
 const limits=result.limit_states;
 // E3/E7: separate Euler buckling about x and y, then include E4 torsion.
 // Slender section Qs and Qa follow E7-4..E7-17; effective web width uses Fcr(Q=1).
 let comp;
 const kx=member.kx,ky=member.ky,ly=member.ly_mm,lx=member.lx_mm;
 if([kx,ky,ly,lx].some(v=>!Number.isFinite(v)||v<=0)){
  comp=status('COMPRESSION','INPUT_REQUIRED','Supply positive Kx,Ky,Lx,Ly independently of Lb.',{clause:'E2/E3/E7'});
 }else {
  const fex=Math.PI**2*e/(kx*lx/rx)**2,fey=Math.PI**2*e/(ky*ly/ry)**2;
  const lz=member.lz_mm,kz=member.kz,g=member.g_mpa;
  if([lz,kz,g].some(v=>!Number.isFinite(v)||v<=0)){
   comp=status('COMPRESSION','INPUT_REQUIRED','Supply Kz,Lz,G to check torsional buckling E4-4.',{
    clause:'E3/E4/E7',trace:{fex_mpa:fex,fey_mpa:fey,
     fcrx_mpa:critical(fex,fy),fcry_mpa:critical(fey,fy)}
   });
  }else if(!(canonical.warping_constant_cw_mm6>=0 && canonical.torsion_constant_j_mm4>0)){
   comp=status('COMPRESSION','INPUT_REQUIRED','Section Properties must supply valid Cw and J for E4-4.',{clause:'E4'});
  }else {
   const fez=(Math.PI**2*e*canonical.warping_constant_cw_mm6/(kz*lz)**2+
    g*canonical.torsion_constant_j_mm4)/(ix+iy);
   const fe=Math.min(fex,fey,fez),baseFcr=critical(fe,fy);
   let qs=1,qa=1,be=cls.hw;
   if(cls.axialFlange==='SLENDER'){
    const lf=cls.lf,ratio=section.fabrication==='BUILT_UP'?
     lf/Math.sqrt(e*cls.kc/fy):lf/Math.sqrt(e/fy);
    qs=section.fabrication==='BUILT_UP'
     ? (ratio<=.64?1:ratio<=1.17?1.415-.65*ratio:.9/(ratio**2))
     : (ratio<=.56?1:ratio<=1.03?1.415-.74*ratio:.69/(ratio**2));
   }
   if(cls.axialWeb==='SLENDER'){
    const f=Math.max(1e-9,baseFcr); // E7-17: Fcr using Q = 1.0
    const root=Math.sqrt(e/f);
    const calc=1.92*section.tw_mm*root*
      (1-.34*root/cls.lw);
    if(!Number.isFinite(calc)||calc<=0)throw new Error('Invalid effective web width E7-17');
    be=Math.min(cls.hw,calc);
    const ae=area-(cls.hw-be)*section.tw_mm;
    qa=ae/area;
   }
   const q=qs*qa;
   if(!(q>0&&q<=1.0001)){
    comp=status('COMPRESSION','REVIEW_REQUIRED','E7 produced invalid Q factor.',{clause:'E7',trace:{qs,qa,q}});
   }else{
    const fcr=cls.axial==='SLENDER'
     ? (q*fy/fe<=2.25?q*Math.pow(.658,q*fy/fe)*fy:.877*fe)
     : baseFcr;
    const nominal=fcr*area/1000;
    comp=value('COMPRESSION',nominal,cls.axial==='SLENDER'?'E7-1/E7-2/E7-3/E7-16/E7-17':'E3-1/E3-2/E3-3/E3-4/E4-4',{
     fex_mpa:fex,fey_mpa:fey,fez_mpa:fez,
     fcrx_mpa:critical(fex,fy),fcry_mpa:critical(fey,fy),
     fcrz_mpa:critical(fez,fy),governing_fcr_mpa:fcr,
     qs,qa,q,effective_web_mm:be,reference_fcr_q1_mpa:baseFcr,
    });
    comp.available=available(nominal,method,'COMPRESSION',factorLib);
   }
  }
 }
 limits.compression=comp;
 // F1: permit conservative Cb=1, even before SAP2000 Importer provides a segment.
 const cb=cbF11(input.moment_diagram??{mode:'CONSERVATIVE'});
 const lb=member.lb_mm;
 let major;
 if(!Number.isFinite(lb)||lb<=0){
  major=status('MAJOR_FLEXURE','INPUT_REQUIRED','Provide a verified major-axis unbraced Lb.',{clause:'F2'});
 }else if(cb.value===null){
  major=status('MAJOR_FLEXURE','REVIEW_REQUIRED',cb.reason,{clause:'F1-1'});
 }else if(cls.flexureWeb==='SLENDER'){
  // Original AISC 360-10 F5: slender-web I shapes, including welded doubly-symmetric sections.
  // The sharp-corner geometry supplies hc = h - 2tf. Rectangular flange F4-11 applies.
  if(section.fabrication!=='BUILT_UP'){
   major=status('MAJOR_FLEXURE','REVIEW_REQUIRED','Rolled-shape fillet and F5 clear web geometry must be verified from profile catalog.',{clause:'F5'});
  }else {
   const d=section.h_mm,tw=section.tw_mm,tf=section.tf_mm,bf=section.bf_mm,ho=d-tf,hc=cls.hw;
   const aw=Math.min(10,hc*tw/(bf*tf)); // F4-12, F5-6 maximum aw=10
   const rt=bf/Math.sqrt(12*(ho/d+aw*d*d/(6*ho*d)));
   const lp=1.1*rt*Math.sqrt(e/fy); // F4-7 referenced in F5
   const lr=Math.PI*rt*Math.sqrt(e/(.7*fy)); // F5-5
   const rpg=Math.min(1,1-aw/(1200+300*aw)*(hc/tw-5.7*Math.sqrt(e/fy)));
   if(!(rpg>0 && Number.isFinite(rt) && rt>0)){
    major=status('MAJOR_FLEXURE','REVIEW_REQUIRED','F5 yielded an invalid Rpg or rt. Review sharp-corner geometric applicability.',{clause:'F5-6/F4-11'});
   }else {
    let fcrLtb=fy,ltClause='F5-1';
    if(lb>lp && lb<=lr){
     fcrLtb=Math.min(fy,cb.value*(fy-.3*fy*(lb-lp)/(lr-lp)));ltClause='F5-3';
    }else if(lb>lr){
     fcrLtb=Math.min(fy,cb.value*Math.PI**2*e/(lb/rt)**2);ltClause='F5-4';
    }
    let fcrFlb=fy,flClause='F5-1';
    if(cls.flexureFlange==='NONCOMPACT'){
     fcrFlb=fy-.3*fy*(cls.lf-cls.limits.lpFlange)/
      (cls.limits.lrMajorFlange-cls.limits.lpFlange);flClause='F5-8';
    }else if(cls.flexureFlange==='SLENDER'){
     fcrFlb=.9*e*cls.kc/cls.lf**2;flClause='F5-9';
    }
    const nominal=Math.min(rpg*fy*sx,rpg*fcrLtb*sx,rpg*fcrFlb*sx)/1e6;
    major=value('MAJOR_FLEXURE',nominal,'F5-1/F5-2/F5-7',{
     cb:cb.value,cb_source:cb.source,lp_mm:lp,lr_mm:lr,rt_mm:rt,rpg,aw,
     mn_yield_kNm:rpg*fy*sx/1e6,mn_ltb_kNm:rpg*fcrLtb*sx/1e6,
     mn_flb_kNm:rpg*fcrFlb*sx/1e6,ltb_clause:ltClause,flb_clause:flClause,
     tension_flange_yielding:'NOT_APPLICABLE_FOR_SYMMETRIC_I',
    });
    major.available=available(nominal,method,'FLEXURE',factorLib);
   }
  }
 }else if(cls.flexureWeb==='NONCOMPACT'){
  major=status('MAJOR_FLEXURE','REVIEW_REQUIRED','F4 noncompact-web plastification and flange interactions require further independent validation.',{clause:'F4'});
 }else if(!(canonical.torsion_constant_j_mm4>0 && canonical.warping_constant_cw_mm6>0)){
  major=status('MAJOR_FLEXURE','INPUT_REQUIRED','Valid J and Cw from Section Properties required.',{clause:'F2-4/F2-7'});
 }else {
  const j=canonical.torsion_constant_j_mm4,cw=canonical.warping_constant_cw_mm6;
  const ho=section.h_mm-section.tf_mm;
  const rts=Math.sqrt(Math.sqrt(iy*cw)/sx);
  const q=j/(sx*ho);
  const lp=1.76*ry*Math.sqrt(e/fy);
  const lr=1.95*rts*e/(.7*fy)*Math.sqrt(q+Math.sqrt(q*q+6.76*(.7*fy/e)**2));
  const mp=fy*zx;
  let ltb, ltClause;
  if(lb<=lp){ltb=mp;ltClause='F2-1 / F2-5';}
  else if(lb<=lr){ltb=Math.min(mp,cb.value*(mp-(mp-.7*fy*sx)*(lb-lp)/(lr-lp)));ltClause='F2-2';}
  else {
   const rr=(lb/rts)**2;
   const fcr=cb.value*Math.PI**2*e/rr*Math.sqrt(1+.078*q*rr);
   ltb=Math.min(mp,fcr*sx);ltClause='F2-3 / F2-4';
  }
  let flb=mp,flClause='F2-1';
  if(cls.flexureFlange==='NONCOMPACT') {
   flb=mp-(mp-.7*fy*sx)*(cls.lf-cls.limits.lpFlange)/(cls.limits.lrMajorFlange-cls.limits.lpFlange);
   flClause='F3-1';
  }else if(cls.flexureFlange==='SLENDER') {
   flb=.9*e*cls.kc*sx/cls.lf**2;flClause='F3-2';
  }
  const nominal=Math.min(ltb,flb)/1e6;
  major=value('MAJOR_FLEXURE',nominal,cls.flexureFlange==='COMPACT'?'F2':'F3',{
   cb:cb.value,cb_source:cb.source,lp_mm:lp,lr_mm:lr,rts_mm:rts,mp_kNm:mp/1e6,
   mn_ltb_kNm:ltb/1e6,mn_flb_kNm:flb/1e6,ltb_clause:ltClause,flb_clause:flClause,
  });
  major.available=available(nominal,method,'FLEXURE',factorLib);
 }
 limits.major_flexure=major;
 // F6 applies to all I-shaped members bent about the minor axis, including slender web.
 let minor;
 const mpY=Math.min(fy*zy,1.6*fy*sy);
 let mny=mpY,flClause='F6-1';
 if(cls.minorFlange==='NONCOMPACT'){
  mny=mpY-(mpY-.7*fy*sy)*(cls.lf-cls.limits.lpFlange)/
   (cls.limits.lrMinorFlange-cls.limits.lpFlange);flClause='F6-2';
 }else if(cls.minorFlange==='SLENDER'){
  mny=.69*e/cls.lf**2*sy;flClause='F6-3/F6-4';
 }
 const nominalMinor=Math.min(mpY,mny)/1e6;
 minor=value('MINOR_FLEXURE',nominalMinor,'F6-1 / '+flClause,{
  mp_kNm:mpY/1e6,flb_kNm:mny/1e6,flange_class:cls.minorFlange});
 minor.available=available(nominalMinor,method,'FLEXURE',factorLib);
 limits.minor_flexure=minor;
 // H1: required axial design strength is compression/tension as applicable; 
 // tension fracture must NOT be inferred from gross area.
 let axial;
 if(n<0)axial=comp;
 else if(n>0)axial=status('TENSION','INPUT_REQUIRED','Gross yielding alone is insufficient. Supply Fu,An,U and connection net-section information for D2/D3.',{clause:'D2/D3'});
 else axial=value('ZERO_AXIAL',0,'H1');
 limits.tension=n>0?axial:status('TENSION','NOT_APPLICABLE','No tensile force demand.',{clause:'D2'});
 if(major.status==='CALCULATED' && minor.status==='CALCULATED' && axial.status==='CALCULATED'){
  const pRatio=n===0?0:Math.abs(n)/axial.available;
  const mxRatio=Math.abs(mx)/major.available,myRatio=Math.abs(my)/minor.available;
  const utilization=pRatio>=.2?pRatio+8/9*(mxRatio+myRatio):pRatio/2+mxRatio+myRatio;
  limits.interaction={...value('INTERACTION',utilization,pRatio>=.2?'H1-1a':'H1-1b',
   {p_ratio:pRatio,mx_ratio:mxRatio,my_ratio:myRatio}),available:1,demand:utilization};
 }else{
  limits.interaction=status('INTERACTION','INPUT_REQUIRED','H1 requires complete axial and both bending resistances; incomplete limit states block D/C.',{clause:'H1-1a/H1-1b'});
 }
 // Phase A/B does NOT mark any member fully PASS: shear, stiffeners, D2 & combined provisions still pending.
 result.warnings=[
  {code:'PARTIAL_STANDARD_SCOPE',message:'Phase A/B computes selected B4,E3,E4,E7,F2,F3,F5,F6,H1 branches; F4 noncompact web, Chapter G and other applicable checks still need verification.'},
  {code:'TFA_NOT_VERIFIED',message:'Web stiffeners and tension field action must be checked independently under Chapter G.'},
  ...(cls.geometry_model==='SHARP_CORNER_ROLLED_APPROXIMATION'?[{code:'ROLLED_FILLET_GEOMETRY',message:'Rolled profile requires actual fillet and effective h from catalogue.'}]:[]),
  ...(cb.source==='CONSERVATIVE'?[{code:'CB_CONSERVATIVE',message:'Cb=1 conservative; replace with same-segment moment diagram when SAP importer is ready.'}]:[]),
 ];
 for(const entry of Object.values(limits))if(entry.status==='INPUT_REQUIRED'||entry.status==='REVIEW_REQUIRED'){
  result.warnings.push({code:entry.id, message:entry.reason});
 }
 return result;
}
