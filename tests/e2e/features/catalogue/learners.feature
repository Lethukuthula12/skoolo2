@manual @learners
Feature: Learner register imports and guardians
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_LEARNER_001 @P0
  Scenario: Import valid learners
    Given administrator A has a workbook matching the import template with two fictional learners
    When they preview and confirm the import into Grade 3 A
    Then exactly two learners persist with the correct names, dates and class

  @TC_LEARNER_002 @P0
  Scenario: Review invalid import rows
    Given an import workbook contains a missing name, invalid date and duplicate admission number
    When administrator A previews it
    Then invalid rows and reasons are shown before saving and no invalid row is silently inserted

  @TC_LEARNER_003 @P1
  Scenario: Create and update learner contacts
    Given administrator A opens the learner register
    When they create a learner and later update guardian contact details
    Then the learner and updated guardian information remain after refresh

  @TC_LEARNER_004 @P1
  Scenario: Move a learner to another class
    Given Learner A belongs to a class with Teacher A
    When the administrator moves the learner to a class with a different teacher
    Then both rosters update and teacher access follows the new assignment

  @TC_LEARNER_005 @P1
  Scenario: Identity and passport validation
    Given the learner editor is open
    When an invalid South African ID is entered and then replaced with a supported passport alternative
    Then invalid identity data is explained and a valid passport learner can be saved

  @TC_LEARNER_006 @P1
  Scenario: Roster print safety
    Given learner names and notes contain angle brackets and quotation marks
    When an administrator prints the selected class roster
    Then text remains literal, essential content is readable and no script or other-school data appears
