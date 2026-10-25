@automated @smoke
Feature: Portal authentication and permissions
  @TC_AUTO_AUTH_001 @P0
  Scenario: Administrator signs in through the form
    Given I am on the portal sign-in screen
    When I sign in with the fictional administrator credentials
    Then I reach the applications workspace

  @TC_AUTO_AUTH_002 @P0
  Scenario: Incorrect password is rejected
    Given I am on the portal sign-in screen
    When I enter an incorrect password
    Then the login is rejected with a readable error

  @TC_AUTO_AUTH_003 @P0
  Scenario: Teacher navigation excludes administrator functions
    Given I am signed in to the portal as "teacherA"
    Then I cannot see enrolment links in teacher navigation

  @TC_AUTO_AUTH_004 @P0
  Scenario: Teacher cannot open applications directly
    Given I am signed in to the portal as "teacherA"
    When I open the portal page "/applications"
    Then I am redirected away from "/applications"

  @TC_AUTO_AUTH_005 @P0
  Scenario: Administrator cannot read another school learners
    Given I am signed in to the portal as "adminA"
    Then the API does not expose School B learners to this account

  @TC_AUTO_AUTH_006 @P0
  Scenario: Teacher cannot read another school learners
    Given I am signed in to the portal as "teacherA"
    Then the API does not expose School B learners to this account
