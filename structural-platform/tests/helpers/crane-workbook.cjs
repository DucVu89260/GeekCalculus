const workbook = require('../fixtures/crane-beam/workbook.json')
function workbookCase(method) {
  const sheet = 'AISC360-' + method
  const cells = workbook.sheets[sheet].cells
  const value = ref => cells[ref].value
  return { method, sheet, cells, dimensions: {
    depth: value('D9') + value('F9') + value('I9'),
    top_flange_width: value('E9'), bottom_flange_width: value('H9'),
    top_flange_thickness: value('F9'), bottom_flange_thickness: value('I9'), web_thickness: value('G9'),
  }, actions: {
    fy: value('H6'), fu: value('H7'), e: value('AQ31'),
    mx_knm: value('E15'), my_knm: value('G15'), vy_kn: value('E16'), vx_kn: value('G16'),
    deflection_x_mm: value('I15'), deflection_y_mm: value('I16'),
    lb_mm: value('H12') * 1000, cb: value('C95'), n_kn: -value('D86'),
    klx_mm: value('H12') * 1000, kly_mm: value('H12') * 1000, klz_mm: value('H12') * 1000,
    // H244 is already the worksheet's impacted wheel effect, used as direct WLmax.
    wlmax_kn: value('H244'), bearing_mm: value('G18') * 10,
    k_mm: value('F9'), stiffener_spacing_mm: value('H10') * 1000,
    // Worksheet nominal J10-2/E222 explicitly assume an interior force;
    // actual end distance and restraint geometry are absent from the workbook.
    end_distance_mm: 2 * (value('D9') + value('F9') + value('I9')),
    compression_flange_braced: false, load_flange_rotation: 'UNRESTRAINED',
    tension_field: value('E10') === 'Y',
  } }
}
module.exports = { workbook, workbookCase }
