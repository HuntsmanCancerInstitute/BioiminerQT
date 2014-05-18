'use strict';

angular.module("useradmin").controller("LabController", [
 '$scope','$http', '$modalInstance','labData','title','bFace',
function ($scope, $http, $modalInstance, labData, title,bFace) {
 
	$scope.title = title;
	$scope.bFace = bFace;
	$scope.lab = angular.copy(labData);
	$scope.usedNames = [];

	
	$scope.ok = function () {
	 $modalInstance.close($scope.lab);
	};
	
	$scope.cancel = function () {
	 $modalInstance.dismiss('cancel');
	};
	
}]);