async function listbox(control) {
  const id = await control.getAttribute('aria-controls')
  return control.page().locator(`[id=${JSON.stringify(id)}]`)
}

async function chooseDesignCode(control, value) {
  await control.click()
  const list = await listbox(control)
  await list.locator(`[role="option"][data-value=${JSON.stringify(value)}]`).click()
}

async function designCodeValue(control) {
  return control.getAttribute('data-value')
}

async function designCodeChoices(control) {
  await control.click()
  const list = await listbox(control)
  const values = await list.getByRole('option').evaluateAll(options => options.map(option => option.getAttribute('data-value')))
  await control.press('Escape')
  return values
}

module.exports = { chooseDesignCode, designCodeValue, designCodeChoices }
