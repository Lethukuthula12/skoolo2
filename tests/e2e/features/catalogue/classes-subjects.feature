@manual @classes_subjects
Feature: Classes subjects and teaching assignments
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_CLASS_001 @P0
  Scenario: Create class and assign teacher
    Given administrator A has selected the current academic year
    When they create Grade 3 class B and assign Teacher A
    Then the class and assignment persist and Teacher A can read its roster

  @TC_CLASS_002 @P0
  Scenario: Subject teacher assignment
    Given administrator A creates Grade 4 A and Mathematics
    When they assign Teacher A to Mathematics in that class
    Then Teacher A can access that assignment and an unassigned teacher cannot

  @TC_CLASS_003 @P1
  Scenario: Duplicate class
    Given Grade 3 A already exists in the current school and year
    When an administrator creates the same class again
    Then the duplicate is rejected without a second class

  @TC_CLASS_004 @P1
  Scenario: Subjects and school defaults
    Given administrator A opens the subjects for a grade
    When they load defaults, rename a subject and load defaults again
    Then saved subjects remain consistent without duplicates and School B is unchanged

  @TC_CLASS_005 @P1
  Scenario: Year and teaching model settings
    Given two schools have different teaching thresholds and classes in two years
    When the administrators change the selected year and teaching model
    Then class and subject views follow each school setting and year without modifying the other school
