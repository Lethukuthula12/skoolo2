@manual @notices
Feature: School notices
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_NOTICE_001 @P0
  Scenario: Publish to the intended audience
    Given administrator A writes Test trip with body and audience
    When they publish and parents refresh
    Then intended School A parents see it and School B parents do not

  @TC_NOTICE_002 @P0
  Scenario: Pin and unpin
    Given School A has multiple published notices
    When an authorised user pins an older notice then unpins it
    Then pin state and ordering update correctly after each action

  @TC_NOTICE_003 @P1
  Scenario: Remove notice
    Given an authorised user can manage a published notice
    When they remove it and confirm
    Then the notice disappears from school and parent views after refresh

  @TC_NOTICE_004 @P1
  Scenario: Validate and escape content
    Given the notice composer is open
    When the user submits missing content or later saves markup-like text
    Then missing fields are rejected and saved text never executes script
