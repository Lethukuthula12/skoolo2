@manual @shared_experience
Feature: Feedback mobile accessibility and installation
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_UX_001 @P0
  Scenario: Feedback below the fold
    Given a long form is scrolled to its bottom
    When a valid save succeeds
    Then floating confirmation is visible without scrolling and saved data survives refresh

  @TC_UX_002 @P0
  Scenario: Failure and retry
    Given the next save will fail because the local API is unavailable
    When the user saves and later retries after recovery
    Then the persistent error never claims success and the retry saves correctly

  @TC_UX_003 @P1
  Scenario: Pause notification dismissal
    Given a success notification is visible
    When the user hovers it, focuses its close button or hides the tab
    Then dismissal pauses and resumes with the remaining time when those conditions end

  @TC_UX_004 @P1
  Scenario: Feedback in modal drawers
    Given a learner or appearance drawer is open
    When the user saves inside it
    Then exactly one notification is visible above drawer content with an operable dismiss button

  @TC_UX_005 @P1
  Scenario: Phone forms and keyboard
    Given both apps are opened on real phones
    When a user completes a long form with the software keyboard visible
    Then fields, save actions and errors are usable without sideways scrolling

  @TC_UX_006 @P1
  Scenario: Keyboard access and reduced motion
    Given reduced motion is enabled
    When the user completes actions using only the keyboard
    Then focus is visible, controls have meaningful names and optional animations are reduced

  @TC_UX_007 @P1
  Scenario: Install parent app
    Given Android Chrome or iOS Safari opens the deployed parent app
    When the user follows Install Skoolo or Add to Home Screen instructions
    Then the installed app opens with usable navigation and correct account state

  @TC_UX_008 @P1
  Scenario: Offline save behaviour
    Given the device loses connectivity while a form is open
    When the user saves and later reconnects
    Then failure is honest and recovery permits a retry without implying unsupported offline sync

  @TC_UX_009 @P1
  Scenario: Dashboard counts
    Given administrator A reviewed applications and saved school records
    When the dashboard and source lists are refreshed
    Then counts agree for School A and exclude School B private data

  @TC_UX_010 @P1
  Scenario: Context cleanup
    Given a private detail or save notification is visible
    When the user navigates away or switches accounts
    Then stale notifications and prior-account data do not reappear
