@automated @smoke
Feature: Linked family access across both apps
  @TC_AUTO_FAMILY_001 @P0
  Scenario: Parent and administrator read the correct learner
    Given I am signed in to the portal as "adminA"
    When the parent signs in and reads their linked children
    Then the administrator still sees only School A learners

  @TC_AUTO_FAMILY_002 @P0
  Scenario: A parent connects a child using the supplied family code
    Given I am signed in to the portal as "adminA"
    When a parent connects Learner A using the family code
    Then the administrator still sees only School A learners
