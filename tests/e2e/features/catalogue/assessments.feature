@manual @assessments
Feature: Assessment scores and calculations
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_ASSESS_001 @P0
  Scenario: Calculate weighted term percentage
    Given two Mathematics assessments have maximums 10 and 20 and equal weights
    When Teacher A records scores 5 and 16 for Learner A
    Then the term percentage is 65 and both scores persist after refresh

  @TC_ASSESS_002 @P0
  Scenario: Roll up into draft reports
    Given assessment scores produce a known term percentage
    When an authorised user rolls them into draft reports
    Then the draft matches the calculation without silently overwriting an approved or published report

  @TC_ASSESS_003 @P1
  Scenario: Reject out of range scores
    Given an assessment has maximum score 10
    When a teacher enters a negative score or a score above 10
    Then the invalid score is rejected and the last valid value remains stored

  @TC_ASSESS_004 @P1
  Scenario: Missing absent and zero marks
    Given learners have a missing mark, an absence and an explicit zero
    When the teacher reviews the grid and analysis
    Then the states remain distinguishable and calculations follow the implemented assessment rules

  @TC_ASSESS_005 @P1
  Scenario: Concurrent save failure
    Given two learner score writes are pending
    When one succeeds and the other fails
    Then the successful score persists, the error is visible and the UI does not claim all scores were saved

  @TC_ASSESS_006 @P1
  Scenario: Export assessment analysis
    Given the selected class has recorded scores
    When the teacher exports assessment and subject analysis
    Then files contain correct scores and totals for the selected class without other-school data
