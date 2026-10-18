export const WIND_GROUPS = [
  {id:'envelope',chapter:28,vi:'MWFRS · Phương pháp đường bao',en:'MWFRS · Envelope procedure'},
  {id:'directional',chapter:27,vi:'MWFRS · Phương pháp hướng gió',en:'MWFRS · Directional procedure'},
  {id:'other',chapter:29,vi:'Công trình khác và bộ phận phụ trợ',en:'Other structures & building appurtenances'},
  {id:'cladding',chapter:30,vi:'Cấu kiện và bao che · C&C',en:'Components & cladding · C&C'},
];
export const WIND_BUILDINGS = [
  {id:'envelope-low-rise',group:'envelope',shape:'gable',ready:true,ref:'Fig. 28.4-1',vi:'Nhà thấp tầng · Kín và nửa kín',en:'Enclosed & partially enclosed · Low-rise buildings'},
  {id:'directional-walls',group:'directional',shape:'gable',ready:true,ref:'Fig. 27.4-1',vi:'Tường và mái · Nhà kín / nửa kín',en:'Walls & roofs · Enclosed / partially enclosed'},
  {id:'domed',group:'directional',shape:'dome',ref:'Fig. 27.4-2',vi:'Mái vòm tròn',en:'Domed roofs'},
  {id:'arched',group:'directional',shape:'arch',ref:'Fig. 27.4-3',vi:'Mái vòm trụ',en:'Arched roofs'},
  {id:'monoslope-free',group:'directional',shape:'mono',ref:'Fig. 27.4-4',vi:'Mái tự do một dốc',en:'Monoslope free roofs'},
  {id:'pitched-free',group:'directional',shape:'gable',ref:'Fig. 27.4-5',vi:'Mái tự do hai dốc',en:'Pitched free roofs'},
  {id:'troughed-free',group:'directional',shape:'trough',ref:'Fig. 27.4-6',vi:'Mái tự do dạng máng',en:'Troughed free roofs'},
  {id:'along-ridge',group:'directional',shape:'mono',ref:'Fig. 27.4-7',vi:'Mái tự do · Gió dọc đỉnh mái',en:'Free roofs · Along-ridge wind'},
  {id:'signs',group:'other',shape:'sign',ref:'Fig. 29.4-1',vi:'Tường độc lập và biển hiệu đặc',en:'Solid freestanding walls & signs'},
  {id:'cc-low-rise',group:'cladding',shape:'gable',ref:'Chapter 30',vi:'Tường và mái · Cấu kiện, bao che',en:'Walls & roofs · Components & cladding'},
];
