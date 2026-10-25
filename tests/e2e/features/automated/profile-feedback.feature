@automated @smoke
Feature: Profile save and action feedback
  @TC_AUTO_PROFILE_001 @P0
  Scenario: Save profile and verify persistence
    Given I am signed in to the portal as "adminA"
    When I open the portal page "/school"
    And I save a new school tagline from the bottom of the form
    Then a floating success notification confirms the saved profile
    And the school tagline remains saved after refresh

  @TC_AUTO_PROFILE_002 @P0
  Scenario: Failed save never claims success
    Given I am signed in to the portal as "adminA"
    And the next school profile update will fail
    When I open the portal page "/school"
    And I save a new school tagline from the bottom of the form
    Then a floating error is shown without claiming success
