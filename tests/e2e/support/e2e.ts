// Do not suppress uncaught exceptions: real application errors should fail the test.
beforeEach(() => {
  cy.request('http://127.0.0.1:4400/__skoolo_local').its('body.local').should('eq', true);
});
