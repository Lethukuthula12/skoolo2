import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor';
import accounts from '../fixtures/accounts.json';

type Role = Exclude<keyof typeof accounts, 'password'>;
const local = () => Cypress.env('local') as { apiUrl: string; anonKey: string };
const urls = () => Cypress.env('appUrls') as { parent: string; portal: string };
let token = '';

Given('I am signed in to the portal as {string}', (role: Role) => {
  if (!accounts[role]) throw new Error('Unknown fictional account: ' + role);
  // Authenticate the real local user; UI login/challenge has a separate scenario below.
  cy.request({ method: 'POST', url: local().apiUrl + '/auth/v1/token?grant_type=password',
    headers: { apikey: local().anonKey }, body: { email: accounts[role], password: accounts.password }, log: false,
  }).then(({ body }) => {
    token = body.access_token;
    cy.visit('/home', { onBeforeLoad(win) { win.localStorage.setItem('sb-127-auth-token', JSON.stringify({ ...body, expires_at: Math.floor(Date.now() / 1000) + body.expires_in })); } });
  });
  cy.location('pathname').should('eq', '/home');
});
When('I open the portal page {string}', (route: string) => { cy.visit(route); });
Then('the portal shows the heading {string}', (heading: string) => { cy.contains('h1', heading).should('be.visible'); });
Then('I am redirected away from {string}', (route: string) => { cy.location('pathname').should('not.eq', route); });
Then('the API does not expose School B learners to this account', () => {
  cy.request({ url: local().apiUrl + '/rest/v1/learners?school_id=eq.e0000000-0000-4000-8000-000000000002&select=id',
    headers: { apikey: local().anonKey, Authorization: `Bearer ${token}` }, log: false,
  }).its('body').should('deep.eq', []);
});
Given('I am on the portal sign-in screen', () => { cy.visit('/sign-in'); });
When('I sign in with the fictional administrator credentials', () => {
  cy.get('#email').type(accounts.adminA); cy.get('#password').type(accounts.password, { log: false });
  cy.get('button[type="submit"]', { timeout: 30000 }).should('not.be.disabled').click();
});
Then('I reach the applications workspace', () => { cy.location('pathname').should('eq', '/applications'); });
When('I enter an incorrect password', () => {
  cy.get('#email').type(accounts.adminA); cy.get('#password').type('Incorrect-Local-Password!', { log: false });
  cy.get('button[type="submit"]', { timeout: 30000 }).should('not.be.disabled').click();
});
Then('the login is rejected with a readable error', () => {
  cy.contains('[role="alert"]', 'That email and password do not match.').should('be.visible');
  cy.location('pathname').should('eq', '/sign-in');
});
When('I save a new school tagline from the bottom of the form', () => {
  cy.get('#tagline').clear().type('Local Cypress school profile');
  cy.get('#tagline').closest('form').find('button[type="submit"]').scrollIntoView().click();
});
Then('a floating success notification confirms the saved profile', () => {
  cy.get('skoolo-feedback-outlet:visible').contains('[role="status"]', 'Profile saved.').should('be.visible');
});
Then('the school tagline remains saved after refresh', () => {
  cy.reload(); cy.get('#tagline').should('have.value', 'Local Cypress school profile');
});
Given('the next school profile update will fail', () => {
  cy.intercept('PATCH', '**/rest/v1/schools*', { statusCode: 503, body: { message: 'Test service unavailable' } }).as('failedSave');
});
Then('a floating error is shown without claiming success', () => {
  cy.wait('@failedSave');
  cy.get('skoolo-feedback-outlet:visible [role="alert"]').should('be.visible');
  cy.get('skoolo-feedback-outlet:visible .success').should('not.exist');
});
Then('I cannot see enrolment links in teacher navigation', () => {
  cy.get('app-shell a[href="/applications"]').should('not.exist');
  cy.get('app-shell a[href="/fees"]').should('not.exist');
});
When('the parent signs in and reads their linked children', () => {
  const args = { api: local().apiUrl, key: local().anonKey, email: accounts.parentA, password: accounts.password };
  cy.origin(urls().parent, { args }, ({ api, key, email, password }) => {
    cy.request({ method: 'POST', url: api + '/auth/v1/token?grant_type=password', headers: { apikey: key }, body: { email, password }, log: false }).then(({ body }) => {
      cy.visit('/children', { onBeforeLoad(win) { win.localStorage.setItem('sb-127-auth-token', JSON.stringify({ ...body, expires_at: Math.floor(Date.now() / 1000) + body.expires_in })); } });
    });
    cy.contains('Lerato').should('be.visible');
    cy.get('app-child-card').should('have.length', 1);
    cy.get('app-child-card').should('contain.text', 'Learner A').and('not.contain.text', 'Learner B');
    cy.reload(); cy.get('app-child-card').should('have.length', 1);
  });
});
Then('the administrator still sees only School A learners', () => {
  cy.visit('/learners');
  // The Learners page defaults to next year; fictional classes are seeded for the current year.
  // A single trigger avoids racing the reload's loading-skeleton re-render.
  cy.get('input.year').invoke('val', String(new Date().getFullYear())).trigger('input');
  cy.contains('Learner A').should('be.visible'); cy.contains('Learner B').should('not.exist');
});

When('a parent connects Learner A using the family code', () => {
  const args = { api: local().apiUrl, key: local().anonKey, email: accounts.newParent, password: accounts.password };
  cy.origin(urls().parent, { args }, ({ api, key, email, password }) => {
    cy.request({ method: 'POST', url: api + '/auth/v1/token?grant_type=password', headers: { apikey: key }, body: { email, password }, log: false }).then(({ body }) => {
      cy.visit('/children', { onBeforeLoad(win) { win.localStorage.setItem('sb-127-auth-token', JSON.stringify({ ...body, expires_at: Math.floor(Date.now() / 1000) + body.expires_in })); } });
    });
    cy.contains('button', 'Connect child').click();
    cy.get('ion-input[formcontrolname="code"]').find('input', { includeShadowDom: true }).type('FAMILYA23');
    cy.get('#connect-child ion-button[type="submit"]').click();
    cy.get('app-child-card').should('have.length', 1).and('contain.text', 'Learner A');
    cy.reload(); cy.get('app-child-card').should('have.length', 1).and('contain.text', 'Learner A');
  });
});
