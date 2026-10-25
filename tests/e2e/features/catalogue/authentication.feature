@manual @authentication
Feature: Authentication and account lifecycle
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_AUTH_001 @P0
  Scenario: Parent signup and email confirmation
    Given a new parent uses an unused example.test email
    When the parent signs up with valid name, phone and password and follows the link in local mail at port 55324
    Then the confirmed account can sign in and open My children

  @TC_AUTH_002 @P0
  Scenario: Password reset returns to the requesting app
    Given a confirmed parent or administrator has signed out
    When they request a reset from their app, follow the local email link and save a new password
    Then the new password works, the old password fails and the return stays in the requesting app

  @TC_AUTH_003 @P1
  Scenario: Invalid signup fields
    Given the parent signup form is open
    When the parent enters an invalid email, phone or short password
    Then invalid fields are identified and no account is created

  @TC_AUTH_004 @P1
  Scenario: Expired and reused links
    Given a confirmation or reset link has expired or already been used
    When the user opens that link
    Then a readable recovery action is shown and no protected account change occurs

  @TC_AUTH_005 @P1
  Scenario: Sign out clears private state
    Given a parent or teacher has opened private learner details
    When they sign out and use browser Back and refresh
    Then private content is absent and protected pages require sign-in

  @TC_AUTH_006 @P1
  Scenario: Account switching
    Given parent A has viewed Learner A and signed out
    When parent B signs in on the same browser
    Then only Learner B appears and no School A private data or notifications remain

  @TC_AUTH_007 @P1
  Scenario: Session loss across tabs
    Given the same account is signed in in two tabs
    When the first tab signs out or the session becomes unrenewable
    Then the other tab removes private content on session loss and protected writes are denied

  @TC_AUTH_008 @P1
  Scenario: CAPTCHA expiry and retry
    Given an authentication form has an expired or failed test challenge
    When the user submits and then obtains a fresh test challenge
    Then stale tokens are not submitted and the fresh challenge allows a new attempt

  @TC_AUTH_009 @P1
  Scenario: Password visibility
    Given a password has been typed on sign-in, signup or school registration
    When the user selects Show and then Hide
    Then the value remains unchanged and the control has the correct accessible label
