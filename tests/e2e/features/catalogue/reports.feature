@manual @reports
Feature: Term reports and publication
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_REPORT_001 @P0
  Scenario: Publish report to parent
    Given Teacher A has completed a draft report for Learner A
    When administrator A approves and publishes it
    Then parent A sees the expected subject results after refresh

  @TC_REPORT_002 @P0
  Scenario: Draft privacy
    Given Learner A has an unpublished draft report
    When parent A opens reports or requests the draft through the API
    Then draft contents are not available to the parent

  @TC_REPORT_003 @P1
  Scenario: Lock approved reports
    Given a report is approved or published
    When a teacher edits marks or comments through UI or API
    Then the report remains unchanged and the restriction is explained

  @TC_REPORT_004 @P1
  Scenario: Fees never withhold reports
    Given Learner A has unpaid fees and a published report
    When parent A opens and prints the report
    Then the published report is available regardless of the balance

  @TC_REPORT_005 @P1
  Scenario: Achievement scale boundaries
    Given marks are 29,30,39,40,49,50,59,60,69,70,79,80
    When the report calculates achievement levels
    Then levels are respectively 1,2,2,3,3,4,4,5,5,6,6,7

  @TC_REPORT_006 @P1
  Scenario: Only administrators approve
    Given Teacher A completed a draft report
    When the teacher tries to approve or publish it
    Then the operation is denied and the report remains a draft

  @TC_REPORT_007 @P1
  Scenario: Print report and export schedule
    Given a report includes school identity, learner, term and subject results
    When a user prints it and an administrator exports the selected class schedule
    Then content is correct and readable and exports match the selected school, year and class

  @TC_REPORT_008 @P1
  Scenario: Other-family report denial
    Given Learner A has a published report
    When parent B or administrator B requests it by identifier
    Then report contents and print data are unavailable
