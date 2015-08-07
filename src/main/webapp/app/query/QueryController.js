'use strict';


/**
 * QueryController
 * @constructor
 */
var query = angular.module('query', ['angularFileUpload','filters', 'services', 'directives', 'ui.bootstrap', 'chosen','angucomplete-alt','dialogs.main','ngProgress','error','ngSanitize','cgBusy']);


angular.module("query").controller("QueryController", 
['$interval', '$window','$rootScope','$scope', '$http', '$modal','$anchorScroll','$upload','$location','$timeout','$q','DynamicDictionary','StaticDictionary','dialogs','ngProgress',
  
function($interval, $window, $rootScope, $scope, $http, $modal, $anchorScroll, $upload, $location, $timeout, $q, DynamicDictionary, StaticDictionary, dialogs, ngProgress) {
	
	$scope.hasResults = false;
	$scope.warnings = "";
	$scope.igvWarnings = "";
	
	$scope.querySummary = [];
	$scope.codeResultType = "REGION";
	$scope.returedResultType = "";
	$scope.isGeneBasedQuery = false;
	$scope.idOrganismBuild = "";
	
	$scope.selectedAnalysisType = "";
	$scope.selectedAnalysisTypes = [];
	$scope.selectedLabs = [];
	$scope.selectedProjects = [];
	$scope.selectedAnalyses = [];
	$scope.selectedSampleSources = [];
	
	$scope.analysisList = [];
	
	$scope.intersectionTarget = "EVERYTHING";
	$scope.regions = "";
	$scope.regionMargins = "1000";
	$scope.genes = "";
	$scope.searchGenes = null;
	$scope.geneMargins = "1000";
	
	$scope.isThresholdBasedQuery = true;
	$scope.thresholdFDR = "";
	$scope.codeThresholdFDRComparison = "LT";
	$scope.thresholdLog2Ratio = "";
	$scope.codeThresholdLog2RatioComparison = "GTABS";
	
	$scope.thresholdVariantQual = "";
	$scope.codeThresholdVariantQualComparison = ">";
	$scope.codeVariantFilterType = "";
	$scope.codeVariantFilterType = "";
	$scope.selectedGenotypes = [];
	$scope.igvLoaded = false;
	
	$scope.hugoList = [];
	
	//Pagination
	$scope.queryCurrentPage = 0;
	$scope.resultPages = 0;
	$scope.resultsPerPage = 25;
	$scope.totalResults = 0;
	$scope.totalAnalyses = 0;
	$scope.totalDatatracks = 0;
	
	$scope.navigationOk = false; //When this is true, you can navigate away from the page
	$scope.queryDeferred = null;
	
	$scope.geneUploadDeferred = null;
	$scope.geneUploadRunning = false;
	$scope.regionUploadDeferred = null;
	$scope.regionUploadRunning = false;
	
	$scope.isReverse = false;
	$scope.searchExisting = false;
	
	//Sorting
	$scope.sortType = "FDR";
	
	//Copy and pase
	$scope.selectAll = false;
	
	$scope.showValidation = false;
	
	
	
	$scope.mapResultType = {
			'REGION' :   'Overlapping Matches',
			'GENE' :     'Exact Matches' };
	$scope.mapResultOrder = ['REGION','GENE'];

	
	$scope.mapComparison = {
		'GT':    '>',
		'GTABS': '> abs',
		'LT':    '<'
	};

	
	$scope.queryResults = [];
	
	/**
	 * Generates a GUID string.
	 * @returns {String} The generated GUID.
	 * @example af8a8416-6e18-a307-bd9c-f2c947bbb3aa
	 * @author Slavik Meltser (slavik@meltser.info).
	 * @link http://slavik.meltser.info/?p=142
	 */
	function guid() {
	    function _p8(s) {
	        var p = (Math.random().toString(16)+"000000000").substr(2,8);
	        return s ? "-" + p.substr(0,4) + "-" + p.substr(4,4) : p ;
	    }
	    return _p8() + _p8(true) + _p8(true) + _p8();
	}
	
	if (!$window.sessionStorage.getItem("idTab")) {
		$window.sessionStorage.setItem("idTab",guid());
		console.log("Tab id now set");
	} else {
		console.log("Tab id ready set")
	}
	
	//Static dictionaries.
    $scope.loadGenotypeList = function () {
    	StaticDictionary.getGenotypeList().success(function(data) {
    		$scope.genotypeList = data;
    	});
    };
    $scope.loadGeneAnnotationList = function () {
    	StaticDictionary.getGeneAnnotationList().success(function(data) {
    		$scope.geneAnnotationList = data;
    	});
    };
    
	$scope.loadAnalysisTypeList = function () {
    	StaticDictionary.getAnalysisTypeList().success(function(data) {
    		$scope.analysisTypeCheckedList = data;
    		for (var idx = 0; idx < $scope.analysisTypeCheckedList.length; idx++) {
    			$scope.analysisTypeCheckedList[idx].show      = true;
    			$scope.analysisTypeCheckedList[idx].codeResultTypes = $scope.analysisTypeCheckedList[idx].codeResultTypes.split(",");
    			$scope.analysisTypeCheckedList[idx].possible = true;
    			$scope.analysisTypeCheckedList[idx].class = '';
    		}
    		$scope.selectedAnalysisType = "";
    		$scope.loadAnalysisTypes();
    	});
    };
    
    
    $scope.$watch("idOrganismBuild",function() {
    	if ($scope.idOrganismBuild != null && $scope.idOrganismBuild != "") {
    		$scope.hugoList = [];
    		$http({
    			url: "query/getHugoNames",
    			method: "GET",
    			params: {idOrganismBuild: $scope.idOrganismBuild}
        	}).success(function(data) {
        		$scope.hugoList = data;
        	});
    	}
    	
    });
    
    $scope.$watch("selectAll",function() {
		for (var i=0;i<$scope.queryResults.length;i++) {
			$scope.queryResults[i].selected = $scope.selectAll;
		}
    });
    
    
    
    $scope.$on('$locationChangeStart', function( event, next, current ) {
    	if ($scope.navigationOk == false) {
    		event.preventDefault();
    		if ($scope.queryStarted) {
        		var dialog = dialogs.confirm("Page Navigation","Query isn't complete, are you sure you want to leave this page");
            	dialog.result.then(function() {
            		$timeout(function() {
            			$scope.abortQuery();
            			$scope.abortGeneUpload();
            			$scope.abortRegionUpload();
            			$location.path(next.substring($location.absUrl().length - $location.url().length));
                        $scope.$apply();
            		});
            		$scope.navigationOk = true;
            	});
        	} else {
        		$timeout(function() {
        			$location.path(next.substring($location.absUrl().length - $location.url().length));
                    $scope.$apply();
        		});
        		$scope.navigationOk = true;
        	}
    	} else {
    		$scope.stopPing();
    		$scope.stopLaunchPing();
    	} 	
    });
    
    $scope.$on('$routeChangeStart', function (event, next, current) {
    	if (next.originalPath == current.originalPath) {
    		$scope.stopPing();
    		$scope.stopLaunchPing();
    	}
    	$scope.abortQuery();
    	$scope.abortGeneUpload();
    	$scope.abortRegionUpload();
    	
    });
    
    window.onbeforeunload = function() {
    	$scope.abortQuery();
    	$scope.abortGeneUpload();
    	$scope.abortGeneUpload();
    }
    
    
    $scope.copyCoordinates = function() {
    	if ($scope.returnedOrganismBuild != $scope.idOrganismBuild) {
    		dialogs.notify("Organism Build Confict","The selected organism build differs from the results.  Copying is disabled to avoid confusing results");
    		return;
    	}
    	
    	ngProgress.start();
    	$scope.codeResultType = "REGION";
    	if ($scope.selectAll) {
    		$http({
    			url: "query/copyAllCoordinates",
    			method: "POST",
    		}).success(function() {
    			ngProgress.complete();
    			$scope.regions = "[All result coordinates]"; 
    		}).error(function(data,status) {
    			if (status == 998) {
    				dialogs.error("Error Retrieving Results","The query results for this user could not be found.  Please submit a bug report.");
    				
    			}
    			ngProgress.reset();
    			$scope.regions = ""; 
    		});
    		  		
    	} else {
    		var coordinateList = [];

        	for (var i=0; i<$scope.queryResults.length; i++) {
        		if ($scope.queryResults[i].selected) {
        			var coord = $scope.queryResults[i].coordinates;
        			if (coordinateList.indexOf(coord) == -1) {
        				coordinateList.push(coord);
        			}
        		}
        	}
        	if (coordinateList.length == 0) {
        		dialogs.notify("No Results Selected","There are no results selected in the table.  Please select individual results or everything before trying to copy coordinates.");
        	}
        	var coordinateEntry = coordinateList.join("\n");
        	$scope.regions = coordinateEntry;
        	ngProgress.complete();
    	}
    	
    	$scope.intersectionTarget = "REGION";
    	
    };
    
    $scope.copyGenes = function() {
    	if ($scope.returnedOrganismBuild != $scope.idOrganismBuild) {
    		dialogs.notify("Organism Build Confict","The selected organism build differs from the results.  Copying is disabled to avoid confusing results.");
    		return;
    	}
    	ngProgress.start();
    	if ($scope.selectAll) {
    		$http({
    			url: "query/copyAllGenes",
    			method: "POST",
    		}).success(function() {
    			ngProgress.complete();
    			$scope.genes = "[All result genes]"; 
    		}).error(function(data,status) {
    			if (status == 998) {
    				dialogs.error("Error Retrieving Results","The query results for this user could not be found.  Please submit a bug report.");
    				
    			}
    			ngProgress.reset();
    			$scope.genes = ""; 
    		});
    	} else {
    		var geneList = [];
        	for (var i=0; i<$scope.queryResults.length; i++) {
        		if ($scope.queryResults[i].selected) {
        			var gene = $scope.queryResults[i].mappedName;
        			if (geneList.indexOf(gene) == -1) {
        				geneList.push(gene);
        			}
        		}
        	}
        	if (geneList.length == 0) {
        		dialogs.notify("No Results Selected","There are no results selected in the table.  Please select individual results or everything before trying to copy genes.");
        	}
        	var geneEntry = geneList.join("\n");
        	$scope.genes = geneEntry;
        	ngProgress.complete();
    	}
    	
    	$scope.intersectionTarget = "GENE";
    	
    };
    
    $scope.loadRegions = function(files) {
    	if (files.length > 0) {
    		$scope.regionUploadDeferred = $q.defer();
    		$scope.regionUploadRunning = true;
        	$scope.uploadCoordinatesPromise = $upload.upload({
        		url: "query/upload",
        		file: files[0],
        		params: {idTab: $window.sessionStorage.getItem("idTab")},
        		timeout: $scope.regionUploadDeferred.promise,
        	}).success(function(data) {
        		$scope.regions = data.regions;
        		if (data.message == null) {
        			$scope.regions = data.regions;
        		} else {
        			var message = data.message;
        			var title = "Error Processing Region File";
        			dialogs.error(title,message,null);
            		
        		}
        		$scope.regionUploadDeferred = null;
        		$scope.regionUploadRunning = false;
        	}).error(function(data,status) {
        		console.log("error loading genes");
        		$scope.regionUploadDeferred = null;
        		$scope.regionUploadRunning = false;
        	});
    	}
    	
	};
	
	$scope.loadGenes = function(files) {
		if (files.length > 0) {
			$scope.geneUploadDeferred = $q.defer();
			$scope.geneUploadRunning = true;
	    	$scope.uploadGenesPromise = $upload.upload({
	    		url: "query/uploadGene",
	    		file: files[0],
	    		params: {idTab: $window.sessionStorage.getItem("idTab")},
	    		timeout: $scope.geneUploadDeferred.promise,
	    	}).success(function(data) {
	    		$scope.genes = data.regions;
	    		if (data.message == null) {
	    			$scope.genes = data.regions;
	    		} else {
	    			var message = data.message;
	    			var title = "Error Processing Gene File";
	    			console.log(message);
	    			dialogs.error(title,message,null);
	        		
	    		}
	    		$scope.geneUploadDeferred = null;
	    		$scope.geneUploadRunning = false;
	    	}).error(function(data,status) {
	    		console.log("error loading genes");
	    		$scope.geneUploadDeferred = null;
	    		$scope.geneUploadRunning = false;
	    	});
		}
	};
	
	$scope.loadIgvSession = function(files) {
		
		$http({
			url: "query/startIgvSession",
			method: "GET"
		}).success(function(data) {
			if (data.warnings == "") {
				$scope.igvWarnings = "";
			} else {
				$scope.igvWarnings = data.warnings;
			}
			
			var urlPass = "http://127.0.0.1:60151/load?file=" + data.url2 + "&merge=true";
			var urlFail = data.url;
			$scope.pingIgvUrl(urlPass, urlFail);
			
			
			
		}).error(function(data) {
			dialogs.error("IGV Session Error",data.error,null);
			
			if (data.warnings == "") {
				$scope.igvWarnings = "";
			} else {
				$scope.igvWarnings = data.warnings;
			}
		});
	};
    
	$scope.loadLocus = function(queryResult) {
		var coord1 = queryResult.coordinates.split(":");
		var coord2 = coord1[1].split("-");
		var start = parseInt(coord2[0]);
		var end = parseInt(coord2[1]);
		
		if (queryResult.analysisType == "Variant") {
			start = start - 50;
			end = end + 50;
		} else {
			start = start - 1000;
			end = end + 1000;
		}
		
		var finalCoord = coord1[0] + ":" + start.toString() + "-" + end.toString();
		var url = "http://127.0.0.1:60151/goto?locus=" + finalCoord;
		
		$http({
			method: "GET",
			url: url
		}).success(function(data) {
			$scope.igvLoaded = true;
		}).error(function(data) {
			$scope.igvLoaded = false;
		});
		
		
	};
	
	$scope.startLaunchPing = function() {
		$scope.stopLaunchPing();
		$scope.checkLaunchIgv = $interval(function() {$scope.pingLaunchIGV();}, 10000);	
	}
	
	$scope.stopLaunchPing = function() {
		$interval.cancel($scope.checkLaunchIgv);
	}
	
	
	$scope.startPing = function() {
		$scope.stopPing();
		$scope.launchCounter = 0;
		$scope.checkIgv = $interval(function() {$scope.pingIGV();}, 10000);
	};
	
	$scope.stopPing = function() {
		$interval.cancel($scope.checkIgv);
		$scope.igvLoaded = false;
	};
	
	$scope.pingIgvUrl = function(urlPass,urlFail) {
		var url = "http://127.0.0.1:60151/execute?command=echo";
		
		$http({
			method: "GET",
			url: url
		}).success(function(data) {
			$scope.igvLoaded = true;
			$window.open(urlPass,"IGV");
			$scope.startPing();
			console.log("IT'S OPEN");
		}).error(function(data) {
			$scope.igvLoaded = false;
			$window.open(urlFail,"IGV");
			$scope.startLaunchPing();
			console.log("IT'S CLOSED");
		});
	};
	
	$scope.pingLaunchIGV = function() {
		var url = "http://127.0.0.1:60151/execute?command=echo";
		$http({
			method: "GET",
			url: url
		}).success(function(data) {
			$scope.launchCounter = 0;
			$scope.stopLaunchPing();
			$scope.startPing();
		}).error(function(data) {
			$scope.launchCounter += 1;
			if ($scope.launchCounter > 30) {
				$scope.stopLaunchPing();
				$scope.launchCounter = 0;
			}
		});
	};
	
	$scope.pingIGV = function() {
		var url = "http://127.0.0.1:60151/execute?command=echo";
		$http({
			method: "GET",
			url: url
		}).success(function(data) {
			$scope.igvLoaded = true;
		}).error(function(data) {
			$scope.igvLoaded = false;
			$scope.stopPing();
		});
	};
	
	$scope.pickResultType = function() {
		for (var x = 0; x < $scope.analysisTypeCheckedList.length; x++) {
			var allowed = false;
			for (var idx = 0; idx < $scope.analysisTypeCheckedList[x].codeResultTypes.length; idx++) {
				if ($scope.codeResultType == $scope.analysisTypeCheckedList[x].codeResultTypes[idx]) {
					allowed = true;
					break;
				}
			}
			$scope.analysisTypeCheckedList[x].show = allowed;
			if ($scope.analysisTypeCheckedList[x].show && $scope.analysisTypeCheckedList[x].possible) {
				$scope.analysisTypeCheckedList[x].class = '';
			} else {
				$scope.analysisTypeCheckedList[x].class = 'grey-out';
				if ($scope.analysisTypeCheckedList[x].idAnalysisType == $scope.selectedAnalysisType.idAnalysisType) {
					$scope.selectedAnalysisType = "";
				}
			}
			
		}
		
		if ($scope.codeResultType == 'GENE' || $scope.codeResultType == 'VARIANT') {
			$scope.isGeneBasedQuery = true;
		} else {
			$scope.isGeneBasedQuery = false;
		}
		
		if ($scope.codeResultType == 'VARIANT') {
			$scope.isThresholdBasedQuery = false;
		} else {
			$scope.isThresholdBasedQuery = true;
		}
	};
		
	$scope.clearQuery = function() {
		console.log("Clearing");
		$scope.warnings = "";
		$scope.igvWarnings = "";
		$scope.hasResults = false;
		$scope.showValidation = false;
		$scope.queryForm.$setPristine();
		
		$scope.querySummary = [];
		$scope.codeResultType = "";
		$scope.isGeneBasedQuery = true;
		$scope.idOrganismBuild = "";

		$scope.selectedLabs.length = 0;
		$scope.selectedProjects.length = 0;
		$scope.selectedAnalyses.length = 0;
		$scope.selectedSampleSources.length = 0;
		
		$scope.intersectionTarget = "";
		$scope.regions = "";
		$scope.regionMargins = "1000";
		$scope.genes = "";
		$scope.geneMargins = "1000";
		
		$scope.isThresholdBasedQuery = true;
		$scope.thresholdFDR = "";
		$scope.codeThresholdFDRComparison = "LT";
		$scope.thresholdLog2Ratio = "";
		$scope.codeThresholdLog2RatioComparison = "GTABS";
		$scope.intersectionTarget = "EVERYTHING";
		
		$scope.thresholdVariantQual = "";
		$scope.codeThresholdVariantQualComparison = ">";
		$scope.codeVariantFilterType = "";
		$scope.codeVariantFilterType = "";
		$scope.selectedGenotypes.length = 0;
		
		$scope.totalResults = 0;
		$scope.totalAnalyses = 0;
		$scope.totalDatatracks = 0;
		
		$scope.selectedAnalysisType = "";
		$scope.searchExisting = false;
		$scope.isReverse = false;
		
		$scope.stopPing();
		$scope.stopLaunchPing();
		
		for (var x =0; x < $scope.analysisTypeCheckedList.length; x++) {
			$scope.analysisTypeCheckedList[x].show = true;
			$scope.analysisTypeCheckedList[x].possible = true;
			$scope.analysisTypeCheckedList[x].class = '';
		}
	};
	
	$scope.lookup = function(array, idAttributeName, id) {
		var element = null;
		for (var x = 0; x < array.length; x++) {
			if (array[x][idAttributeName] == id) {
				element = array[x];
				break;
			}
		}
		return element;
	};
	
	$scope.$watch("searchGenes",function() {
		if ($scope.searchGenes != null) {
			if ($scope.genes == "") {
				$scope.genes = $scope.searchGenes.title;
			} else {
				if ($scope.genes != null) {
					$scope.genes = $scope.genes + "," + $scope.searchGenes.title;
				} else {
					$scope.genes = $scope.searchGenes.title;
				}
				
			}
		}
		
	});
	
	$scope.addGene = function() {
		if ($scope.searchGenes != null) {
			
			$scope.searchGenes = null;
		}
	};
	
	
	$scope.buildQuerySummary = function() {
		$scope.querySummary.length = 0;
		
		// Type of results
		$scope.querySummary.push("FIND  " + $scope.mapResultType[$scope.codeResultType]);
		
		// Genome build
		var ob = $scope.lookup($scope.organismBuildList, 'idOrganismBuild', $scope.idOrganismBuild);
		$scope.querySummary.push("FOR BUILD  " + ob.organism.common + ' ' + ob.name);
		
		// Data sets
		var datasetSummary = "";
		
		
		var atDisplay = $scope.selectedAnalysisType.type;
		
		if (atDisplay.length > 0) {
			datasetSummary = "ON  " 
				
				
			if ($scope.searchExisting) {
				datasetSummary += " previous query "
			} else {
				datasetSummary += atDisplay + " data sets";
				
				// lab
				var labDisplay = $.map($scope.selectedLabs, function(lab){
				    return lab.first + ' ' + lab.last + ' lab';
				}).join(', ');
				if (labDisplay.length > 0) {
					datasetSummary += "  submitted by  " + labDisplay;
				}
				
				// project
				var projectDisplay = $.map($scope.selectedProjects, function(project){
				    return project.name;
				}).join(', ');
				if (projectDisplay.length > 0) {
					datasetSummary += "  for projects  " + projectDisplay;
				}

				// analysis
				var analysisDisplay = $.map($scope.selectedAnalyses, function(analysis){
				    return analysis.name;
				}).join(', ');
				if (analysisDisplay.length > 0) {
					datasetSummary += "  for analysis  " + analysisDisplay;
				}

				// sample source
				var sampleSourcesDisplay = $.map($scope.selectedSampleSources, function(ss){
				    return ss.source;
				}).join(', ');
				if (sampleSourcesDisplay.length > 0) {
					datasetSummary += " for samples from " + sampleSourcesDisplay;
				}
			}
				
			
			$scope.querySummary.push(datasetSummary);

		}
		
		

		// intersect
		var intersectSummary = "";
		if ($scope.isReverse == false) {
			intersectSummary = "THAT INTERSECT ";
		} else if ($scope.isReverse == true) {
			intersectSummary = "THAT DON'T INTERSECT ";
		}		
		if (intersectSummary.length > 0) {
			if ($scope.intersectionTarget == 'REGION') {
				// Region based query
				if ($scope.regions.length > 0 && $scope.regions.length < 100) {
					$scope.querySummary.push(intersectSummary + "REGIONS   " + $scope.regions + " +/- " + $scope.regionMargins);					
				}
				
			} else if ($scope.intersectionTarget == 'GENE') {
				// Gene based query
				if ($scope.genes.length > 0 && $scope.genes.length < 100) {
					$scope.querySummary.push(intersectSummary + "GENES   " + $scope.genes + " +/- " + $scope.geneMargins);	
				}
				
			} else {
				$scope.querySummary.push(intersectSummary + " anything ");
			}
		}
		if ($scope.isThresholdBasedQuery) {
			
			var thresholdQuery = "";
			
			if ($scope.thresholdFDR != null && $scope.thresholdFDR != undefined && $scope.thresholdFDR != "") {
				thresholdQuery = "THAT EXCEED THRESHOLD of  " + "FDR " + $scope.mapComparison[$scope.codeThresholdFDRComparison] + ' ' + $scope.thresholdFDR;
			}
			if ($scope.thresholdLog2Ratio != null && $scope.thresholdLog2Ratio != undefined && $scope.thresholdLog2Ratio != "") {
				thresholdQuery = thresholdQuery + (thresholdQuery.length > 0 ? " AND ": " THAT EXCEED THRESHOLD   ");
				thresholdQuery = thresholdQuery + "Log2Ratio " + $scope.mapComparison[$scope.codeThresholdLog2RatioComparison] + ' ' + $scope.thresholdLog2Ratio;
				
			}
			
			if (thresholdQuery.length > 0) {
				$scope.querySummary.push(thresholdQuery);
			}
		} else {
			var variantQuery = "";
			if ($scope.thresholdVariantQual) {
				variantQuery = "QUAL " +  $scope.codeThresholdVariantQualComparison + ' ' + $scope.thresholdVariantQual;
			}
			if ($scope.codeVariantFilterPass) {
				if (variantQuery.length > 0) {
					variantQuery = variantQuery + ", ";
				}
				variantQuery = variantQuery + " " + $scope.codeVariantFilterPass;
			}
			if ($scope.codeVariantFilterType) {
				if (variantQuery.length > 0) {
					variantQuery = variantQuery + ", ";
				}
				variantQuery = variantQuery + "  " + $scope.codeVariantFilterType;
			}
			if ($scope.selectedGenotypes.length > 0) {
				$scope.display = "";
				$scope.selectedGenotypes.forEach($scope.concatDisplayName);
				if (variantQuery.length > 0) {
					variantQuery = variantQuery + ", ";
				}
				variantQuery = variantQuery + " " + $scope.display;
				
			}
			if (variantQuery.length > 0) {
				$scope.querySummary.push("FOR VARIANTS MATCHING " + variantQuery);
			}
		}
		
 	};
	
	$scope.concatDisplayName = function(element, index, array) {
  	  if ($scope.display.length > 0) {
		  $scope.display += ", ";
	  }
  	  $scope.display +=  element.name;
	};
	
	
	$scope.displayWarnings = function(type){
		
		
		var warnings = $scope.warnings;
		var title = "Query Warnings";
		if (type == "igv") {
			
			warnings = $scope.igvWarning;
			title = "IGV Session Warnings";
		} 
		
		dialogs.error(title,warnings,null);
		
	};

	
	$scope.runQuery = function(isInvalid) {
		if (isInvalid) {
			$scope.showValidation = true;
			return;
		}
		
		
		$scope.selectAll = false;
		
		$scope.warnings = "";
		$scope.igvWarnings = "";
		$scope.showValidation = false;
		$scope.hasResults = false;
		$scope.queryCurrentPage = 0;
		
		//Turn query state to on
		$scope.stopPing();
		$scope.stopLaunchPing();
		
		$scope.queryStarted = true;
		$scope.queryDeferred = $q.defer();
		
		// Build a summary of the query that is being performed.  This will display
		// in the results panel
		$scope.buildQuerySummary();
		
		var idAnalysisTypeParams = $.map($scope.selectedAnalysisTypes, function(analysisType){
		    return analysisType.idAnalysisType;
		}).join(',');
		
		var idLabParams = $.map($scope.selectedLabs, function(lab){
		    return lab.idLab;
		}).join(',');
		
		var idProjectParams = $.map($scope.selectedProjects, function(project){
		    return project.idProject;
		}).join(',');
		
		var idAnalysisParams = $.map($scope.selectedAnalyses, function(analysis){
		    return analysis.idAnalysis;
		}).join(',');
		
		var idSampleSourceParams = $.map($scope.selectedSampleSources, function(ss){
		    return ss.idSampleSource;
		}).join(',');
		
		var fdr = "";
		if ($scope.thresholdFDR !== "" && $scope.thresholdFDR != null) {
			fdr = $scope.thresholdFDR;
		}
		
		var log2ratio = "";
		if ($scope.thresholdLog2Ratio !== "" && $scope.thresholdLog2Ratio != null) {
			log2ratio = $scope.thresholdLog2Ratio;
		}
		
		var regions = "";
		if ($scope.regions != null && $scope.regions != "") {
			if ($scope.regions.length > 1000) {
				$scope.queryStarted = false;
				dialogs.error("Regions Error","There are more than 1000 characters in the region list, please upload a file instead.");
				return;
			}
			regions = $scope.regions;
		}
		
		var regionMargins = "";
		if ($scope.regionMargins != null && $scope.regionMargins != "") {
			regionMargins = $scope.regionMargins;
		}
		
		var genes = "";
		if ($scope.genes != null && $scope.genes != "") {
			if ($scope.genes.length > 1000) {
				$scope.queryStarted = false;
				dialogs.error("Genes Error","There are more than 1000 characters in gene list, please upload a file instead.");
				
				return;
			}
			genes = $scope.genes;
		}
		
		var geneMargins = "";
		if ($scope.geneMargins != null && $scope.geneMargins != "") {
			geneMargins = $scope.geneMargins;
		}
		
		
		$scope.returnedResultType = $scope.codeResultType;
		$scope.returnedAnalysisType = angular.copy($scope.selectedAnalysisType);
		$scope.returnedOrganismBuild = angular.copy($scope.idOrganismBuild);
		$scope.totalResults = 0;
		
		
		
		// Run the query on the server.
		$scope.runQueryPromise = $http({
			url: "query/run",
			method: "GET",
			params: {codeResultType:          $scope.codeResultType,
				     idOrganismBuild:         $scope.idOrganismBuild,
				     idAnalysisTypes:         idAnalysisTypeParams,
				     idLabs:                  idLabParams,
				     idProjects:              idProjectParams,
				     idAnalyses:              idAnalysisParams,
				     idSampleSources:         idSampleSourceParams,
				     regions:                 regions,
				     regionMargins:           regionMargins,
				     genes:                   genes,
				     geneMargins:             geneMargins,
				     FDR:                     fdr,
				     codeFDRComparison:       $scope.codeThresholdFDRComparison,
				     log2Ratio:               log2ratio,
				     codeLog2RatioComparison: $scope.codeThresholdLog2RatioComparison,
				     resultsPerPage:          $scope.resultsPerPage,
				     sortType:                $scope.sortType,
				     intersectionTarget:	  $scope.intersectionTarget,
				     isReverse:               $scope.isReverse,
				     searchExisting: 		  $scope.searchExisting,
				     idTab: 				  $window.sessionStorage.getItem("idTab"),
				     },
		    timeout: $scope.queryDeferred.promise,
				     
		}).success(function(data) {
			if (data != null) {
				$scope.queryResults = data.resultList;
				$scope.resultPages = data.pages;
				$scope.totalResults = data.resultNum;
				$scope.totalAnalyses = data.analysisNum;
				$scope.totalDatatracks = data.dataTrackNum;
				$scope.hasResults = true;
			}
			
			
			$http({
				url: "query/warnings",
				method: "GET",
				params: {idTab: $window.sessionStorage.getItem("idTab")},
			}).success(function(data) {
				if (data == "") {
					$scope.warnings = "";
				} else {
					$scope.warnings = data;
				}
			});
			$scope.queryStarted = false;
			$scope.queryDeferred = null;
		}).error(function(data, status, headers, config) {
			$scope.hasResults = false;
			$scope.resultPages = 0;
			$scope.totalResults = 0;
			$scope.totalAnalyses = 0;
			$scope.totalDatatracks = 0;
			$scope.returnedResultType = null;
			$scope.queryStarted = false;
			$scope.queryDeferred = null;
		});
		
		
		$window.sessionStorage.getItem("idTab");
		$anchorScroll();

	};
	
	$scope.abortQuery = function() {
		if ($scope.queryDeferred != null) {
			$scope.queryDeferred.resolve("Query aborted by user");
			$scope.queryDeferred = null;
		}
	};
	
	$scope.abortGeneUpload = function() {
		if ($scope.geneUploadDeferred != null) {
			$scope.geneUploadDeferred.resolve("Upload aborted by user");
			$scope.geneUploadDeferred = null;
		}
	}
	
	$scope.abortRegionUpload = function() {
		if ($scope.regionUploadDeferred != null) {
			$scope.regionUploadDeferred.resolve("Upload aborted by user");
			$scope.regionUploadDeferred = null;
		}
	}
	
	$scope.downloadAnalysis = function() {
		$http({
			url: "query/downloadAnalysis",
			method: "GET"
		});
	};
	
	$scope.changeTablePosition = function() {
		$http({
			url: "query/changeTablePosition",
			method: "GET",
			params: {resultsPerPage:          $scope.resultsPerPage,
				     pageNum:                 $scope.queryCurrentPage,
				     sortType:                $scope.sortType},
				     
		}).success(function(data) {
			if (data != null) {
				$scope.queryResults = data.resultList;
				$scope.resultPages = data.pages;
				$scope.totalResults = data.resultNum;
				$scope.hasResults = true;
			}
			
			$http({
				url: "query/warnings",
				method: "GET",
				params: {idTab: $window.sessionStorage.getItem("idTab")},
			}).success(function(data) {
				if (data == "") {
					$scope.warnings = "";
				} else {
					$scope.warnings = data;
				}
			});
			
		}).error(function(data, status, headers, config) {
			console.log("Could not change page!");
			$scope.hasResults = false;
		});
	};
	
	$scope.loadOrganismBuildList = function() {		
		var idAnalysisTypeParams = $.map($scope.selectedAnalysisTypes, function(analysisType){
		    return analysisType.idAnalysisType;
		}).join(',');
		
		var idLabParams = $.map($scope.selectedLabs, function(lab){
		    return lab.idLab;
		}).join(',');
		
		var idProjectParams = $.map($scope.selectedProjects, function(project){
		    return project.idProject;
		}).join(',');
		
		var idAnalysisParams = $.map($scope.selectedAnalyses, function(analysis){
		    return analysis.idAnalysis;
		}).join(',');
		
		var idSampleSourceParams = $.map($scope.selectedSampleSources, function(ss){
		    return ss.idSampleSource;
		}).join(',');
	
		// Run the query on the server.
		$http({
			url: "query/getQueryOrganismBuilds",
			method: "GET",
			params: {
				     idAnalysisTypes:         idAnalysisTypeParams,
				     idLabs:                  idLabParams,
				     idProjects:              idProjectParams,
				     idAnalyses:              idAnalysisParams,
				     idSampleSources:         idSampleSourceParams},
		}).success(function(data) {
			$scope.organismBuildList = data;
		}).error(function(data, status, headers, config) {
			console.log("Could not get organismBuildList");
		});
	};
	
	
	$scope.loadLabs = function() {
		var deferred = $q.defer();
		
		var idAnalysisTypeParams = $.map($scope.selectedAnalysisTypes, function(analysisType){
		    return analysisType.idAnalysisType;
		}).join(',');
		
		var idProjectParams = $.map($scope.selectedProjects, function(project){
		    return project.idProject;
		}).join(',');
		
		var idAnalysisParams = $.map($scope.selectedAnalyses, function(analysis){
		    return analysis.idAnalysis;
		}).join(',');
		
		var idSampleSourceParams = $.map($scope.selectedSampleSources, function(ss){
		    return ss.idSampleSource;
		}).join(',');
		
		if ($scope.idOrganismBuild == null) {
			$scope.idOrganismBuild = "";
		}
	
		// Run the query on the server.
		$http({
			url: "query/getQueryLabs",
			method: "GET",
			params: {
				     idAnalysisTypes:         idAnalysisTypeParams,
				     idProjects:              idProjectParams,
				     idAnalyses:              idAnalysisParams,
				     idSampleSources:         idSampleSourceParams,
				     idOrganismBuild:         $scope.idOrganismBuild},
		}).success(function(data) {
			$scope.labList = data;
			deferred.resolve();
		}).error(function(data, status, headers, config) {
			console.log("Could not get labList");
			deferred.reject();
		});
		
		return deferred.promise;
	};
	
	$scope.loadProjects = function() {
		var deferred = $q.defer();
		var idAnalysisTypeParams = $.map($scope.selectedAnalysisTypes, function(analysisType){
		    return analysisType.idAnalysisType;
		}).join(',');
		
		var idLabParams = $.map($scope.selectedLabs, function(lab){
		    return lab.idLab;
		}).join(',');
		
		var idAnalysisParams = $.map($scope.selectedAnalyses, function(analysis){
		    return analysis.idAnalysis;
		}).join(',');
		
		var idSampleSourceParams = $.map($scope.selectedSampleSources, function(ss){
		    return ss.idSampleSource;
		}).join(',');
	
		if ($scope.idOrganismBuild == null) {
			$scope.idOrganismBuild = "";
		}
		
		// Run the query on the server.
		$http({
			url: "query/getQueryProjects",
			method: "GET",
			params: {
				     idAnalysisTypes:         idAnalysisTypeParams,
				     idLabs:                  idLabParams,
				     idAnalyses:              idAnalysisParams,
				     idSampleSources:         idSampleSourceParams,
				     idOrganismBuild:         $scope.idOrganismBuild},
		}).success(function(data) {
			$scope.projectList = data;
			deferred.resolve();
		}).error(function(data, status, headers, config) {
			console.log("Could not get project list");
			deferred.reject();
		});
		return deferred.promise;
	};
	
	$scope.loadAnalyses = function() {
		var deferred = $q.defer();
		var idAnalysisTypeParams = $.map($scope.selectedAnalysisTypes, function(analysisType){
		    return analysisType.idAnalysisType;
		}).join(',');
		
		var idLabParams = $.map($scope.selectedLabs, function(lab){
		    return lab.idLab;
		}).join(',');
		
		var idProjectParams = $.map($scope.selectedProjects, function(project){
		    return project.idProject;
		}).join(',');
		
		var idSampleSourceParams = $.map($scope.selectedSampleSources, function(ss){
		    return ss.idSampleSource;
		}).join(',');
		
		if ($scope.idOrganismBuild == null) {
			$scope.idOrganismBuild = "";
		}
	
		// Run the query on the server.
		$http({
			url: "query/getQueryAnalyses",
			method: "GET",
			params: {
				     idAnalysisTypes:         idAnalysisTypeParams,
				     idLabs:                  idLabParams,
				     idProjects:              idProjectParams,
				     idSampleSources:         idSampleSourceParams,
				     idOrganismBuild:         $scope.idOrganismBuild},
		}).success(function(data) {
			$scope.analysisList = data;
			deferred.resolve();
		}).error(function(data, status, headers, config) {
			console.log("Could not get analysis list");
			deferred.reject();
		});
		return deferred.promise;
	};
	
	$scope.loadSampleSources = function() {
		var deferred = $q.defer();
		var idAnalysisTypeParams = $.map($scope.selectedAnalysisTypes, function(analysisType){
		    return analysisType.idAnalysisType;
		}).join(',');
		
		var idLabParams = $.map($scope.selectedLabs, function(lab){
		    return lab.idLab;
		}).join(',');
		
		var idProjectParams = $.map($scope.selectedProjects, function(project){
		    return project.idProject;
		}).join(',');
		
		var idAnalysisParams = $.map($scope.selectedAnalyses, function(analysis){
		    return analysis.idAnalysis;
		}).join(',');
		
		if ($scope.idOrganismBuild == null) {
			$scope.idOrganismBuild = "";
		}
		
		// Run the query on the server.
		$http({
			url: "query/getQuerySampleSource",
			method: "GET",
			params: {
				     idAnalysisTypes:         idAnalysisTypeParams,
				     idLabs:                  idLabParams,
				     idProjects:              idProjectParams,
				     idAnalyses:              idAnalysisParams,
				     idOrganismBuild:         $scope.idOrganismBuild},
		}).success(function(data) {
			$scope.sampleSourceList = data;
			deferred.resolve();
		}).error(function(data, status, headers, config) {
			console.log("Could not get sample source list");
			deferred.reject();
		});
		return deferred.promise;
	};
	
	$scope.loadAnalysisTypes = function() {		
		var deferred = $q.defer();
		
		var idLabParams = $.map($scope.selectedLabs, function(lab){
		    return lab.idLab;
		}).join(',');
		
		var idProjectParams = $.map($scope.selectedProjects, function(project){
		    return project.idProject;
		}).join(',');
		
		var idAnalysisParams = $.map($scope.selectedAnalyses, function(analysis){
		    return analysis.idAnalysis;
		}).join(',');
	
	
		var idSampleSourceParams = $.map($scope.selectedSampleSources, function(ss){
		    return ss.idSampleSource;
		}).join(',');
		
		if ($scope.idOrganismBuild == null) {
			$scope.idOrganismBuild = "";
		}
	
		// Run the query on the server.
		$http({
			url: "query/getQueryAnalysisTypes",
			method: "GET",
			params: {
				     idSampleSources:         idSampleSourceParams,
				     idLabs:                  idLabParams,
				     idProjects:              idProjectParams,
				     idAnalyses:              idAnalysisParams,
				     idOrganismBuild:         $scope.idOrganismBuild},
		}).success(function(data) {
			for (var idx = 0; idx < $scope.analysisTypeCheckedList.length; idx++) {
				var found  = false;
				for (var idx2 = 0; idx2 < data.length; idx2++) {
					if ($scope.analysisTypeCheckedList[idx].idAnalysisType == data[idx2].idAnalysisType) {
						found = true;
					}
				}
				
				
				if (!found) {
					$scope.analysisTypeCheckedList[idx].possible = false;
					$scope.analysisTypeCheckedList[idx].class = 'grey-out';
					if ($scope.selectedAnalysisType.idAnalysisType == $scope.analysisTypeCheckedList[idx].idAnalysisType) {
						$scope.selectedAnalysisType = "";
					}
				} else {
					$scope.analysisTypeCheckedList[idx].possible = true;
					if ($scope.analysisTypeCheckedList[idx].show) {
						$scope.analysisTypeCheckedList[idx].class = '';
					}
				}
    		}
			deferred.resolve();
		}).error(function(data, status, headers, config) {
			console.log("Could not get analysis type list");
			deferred.reject();
		});
		return deferred.promise;
	};
	
	//Create watchers
	$scope.$watch("selectedAnalysisType",function(newValue, oldValue) {
		if (newValue != oldValue) {
			$scope.selectedAnalysisTypes = [];
			$scope.selectedAnalysisTypes.push($scope.selectedAnalysisType);
			$scope.loadOrganismBuildList();
			$scope.loadLabs();
			$scope.loadProjects();
			$scope.loadAnalyses();
			$scope.loadSampleSources();
		}
	});
	
	$scope.$watch("selectedLabs",function(newValue, oldValue) {
		if (newValue != oldValue) {
			$scope.loadOrganismBuildList();
			$scope.loadProjects();
			$scope.loadAnalyses();
			$scope.loadSampleSources();
			$scope.loadAnalysisTypes();
			
		}
	});
	
	$scope.$watch("selectedAnalyses",function(newValue, oldValue) {
		if (newValue != oldValue) {
			$scope.loadOrganismBuildList();
			$scope.loadLabs();
			$scope.loadProjects();
			$scope.loadSampleSources();
			$scope.loadAnalysisTypes();
		}
	});
	
	$scope.$watch("selectedSampleSources",function(newValue, oldValue) {
		if (newValue != oldValue) {
			$scope.loadOrganismBuildList();
			$scope.loadLabs();
			$scope.loadProjects();
			$scope.loadAnalyses();
			$scope.loadAnalysisTypes();
		}
	});
	
	$scope.$watch("selectedProjects",function(newValue, oldValue) {
		if (newValue != oldValue) {
			$scope.loadOrganismBuildList();
			$scope.loadLabs();
			$scope.loadAnalyses();
			$scope.loadSampleSources();
			$scope.loadAnalysisTypes();
		}
	});
	
	$scope.$watch("idOrganismBuild",function(newValue, oldValue) {
		
		if (typeof newValue != 'undefined' && newValue != oldValue) {
			$scope.loadLabs();
			$scope.loadProjects();
			$scope.loadAnalyses();
			$scope.loadSampleSources();
			$scope.loadAnalysisTypes();
			$scope.regions = "";
			$scope.genes = "";
			$scope.intersectionTarget = "EVERYTHING";
			$scope.selectAll = false;
		}
	});
	
	$scope.loadExistingResults = function() {
		$scope.loadExistingPromise = $http({
			method: "GET",
			url: "query/loadExistingResults",
			params: {idTab: $window.sessionStorage.getItem("idTab")}
		}).success(function(data) {
			ngProgress.complete();
			if (data != null && data != "") {
				$scope.queryResults = data.resultList;
				$scope.resultPages = data.pages;
				$scope.totalResults = data.resultNum;
				$scope.totalAnalyses = data.analysisNum;
				$scope.totalDatatracks = data.dataTrackNum;
				$scope.hasResults = true;
			}
			$http({
				url: "query/warnings",
				method: "GET",
				params: {idTab: $window.sessionStorage.getItem("idTab")},
			}).success(function(data) {
				if (data == "") {
					$scope.warnings = "";
				} else {
					$scope.warnings = data;
				}
			});
		}).error(function(data) {
			$scope.hasResults = false;
			$scope.resultPages = 0;
			$scope.totalResults = 0;
			$scope.totalAnalyses = 0;
			$scope.totalDatatracks = 0;
			
		});
	};
	
	$scope.loadExistingSettings = function() {
		$http({
			method: "GET",
			url: "query/loadExistingSettings",
			params: {idTab: $window.sessionStorage.getItem("idTab")}
		}).success(function(data) {
			if (data != null && data != "") {
				$scope.codeResultType = data.codeResultType;
				$scope.returnedResultType = data.codeResultType;
				$scope.intersectionTarget = data.target;
				
				
				$scope.idOrganismBuild = data.idOrganismBuild;

				for (var i=0;i<$scope.analysisTypeCheckedList.length;i++) {
					for (var j=0;j<data.idAnalysisTypes.length;j++) {
						if ($scope.analysisTypeCheckedList[i].idAnalysisType == data.idAnalysisTypes[j]) {
							$scope.selectedAnalysisType = $scope.analysisTypeCheckedList[i];
							$scope.returnedAnalysisType = angular.copy($scope.selectedAnalysisType);
						}
					}
				}
				
				for (var i=0; i<$scope.analysisList.length;i++) {
					for (var j=0; j < data.idAnalyses; j++) {
						if ($scope.analysisList[i].idAnalysis == data.idAnalyses[j]) {
							$scope.selectedAnalyses.push($scope.analysisList[i]);
						}
					}
				}
				
				for (var i=0; i<$scope.projectList.length;i++) {
					for (var j=0; j < data.idProjects.length; j++) {
						if ($scope.projectList[i].idProject == data.idProjects[j]) {
							$scope.selectedProjects.push($scope.projectList[i]);
						}
					}
				}
				
				for (var i=0; i<$scope.labList.length;i++) {
					for (var j=0; j < data.idLabs.length; j++) {
						if ($scope.labList[i].idLab == data.idLabs[j]) {
							$scope.selectedLabs.push($scope.labList[i]);
						}
					}
				}
			
				for (var i=0; i<$scope.sampleSourceList.length;i++) {
					for (var j=0; j < data.idSampleSources.length; j++) {
						if ($scope.sampleSourceList[i].idSampleSource == data.idSampleSources[j]) {
							$scope.selectedSampleSources.push($scope.sampleSourceList[i]);
						}
					}
				}
				
				$scope.regions = data.regions;
				$scope.regionMargins = data.regionMargins;
				$scope.genes = data.genes;
				$scope.geneMargins = data.geneMargins;
				
				if (data.fdr == null) {
					$scope.thresholdFDR = "";
				} else {
					$scope.thresholdFDR  = data.fdr;
				}
				
				if (data.log2Ratio == null) {
					$scope.thresholdLog2Ratio = "";
				} else {
					$scope.thresholdLog2Ratio = data.log2Ratio;
				}
				
				$scope.codeThresholdFDRComparison = data.codeFDRComparison;
				$scope.codeThresholdLog2RatioComparison = data.codeLog2RatioComparison;
				$scope.resultsPerPage = data.resultsPerPage;
				$scope.sortType = data.sortType;
				$scope.isReverse = data.reverse;
				
				
				$scope.buildQuerySummary();
			
				setTimeout(function () {
			        $scope.$apply(function() {
			        	$scope.searchExisting = data.searchExisting;
			        });
			    }, 1000);
				
			}  
		}).error(function(data) {
			console.log("calling clearQuery from error");
			$scope.clearQuery();
		});
	};

	//Load up dynamic dictionaries, which return promises
	var prepList = [];
	prepList.push($scope.loadLabs());
	prepList.push($scope.loadOrganismBuildList());
	prepList.push($scope.loadAnalysisTypeList());
	prepList.push($scope.loadProjects());
	prepList.push($scope.loadAnalyses());
	prepList.push($scope.loadSampleSources());
	
	//When all dictionaries are loaded, load settings
	$q.all(prepList).then(function() {});
	
	
	$scope.loadExistingData = function() {
		$q.all(prepList).then(function() {
		  $scope.loadExistingSettings();
		  $scope.loadExistingResults();
	     });
	}
	

	$scope.loadGenotypeList();
	$scope.loadGeneAnnotationList();
	
	
	
	$scope.showHelpFind = function() {
		var title = "Help: What would you like to find?";
		
		dialogs.notify(title, $scope.helpFind);
	}
	
	$scope.showHelpOrganism = function() {
		var title = "Help: What Genome?";
		dialogs.notify(title, $scope.helpOrganism);	
	}
	
	$scope.showHelpDataset = function() {
		var title = "Help: What Datasets?";
		dialogs.notify(title, $scope.helpDataset);	
	}
	
	$scope.showHelpThatIntersect = function() {
		var title = "Help: That Intersect/Don't Intersect";
		dialogs.notify(title, $scope.helpIntersect);
	}
	
	$scope.showHelpThresholds = function() {
		var title = "Help: That Exceed these Thresholds";
		dialogs.notify(title, $scope.helpThresholds);
	}
	
	$scope.showHelpResultPanel = function() {
		var title = "Help: Result Panel";
		dialogs.notify(title, $scope.helpResults);
	}
	
	$scope.showHelpQueryPanel = function() {
		var title = "Help: Query Panel";
		dialogs.notify(title, $scope.helpQuery + $scope.helpFind + $scope.helpOrganism + $scope.helpDatasets + $scope.helpIntersect + $scope.helpThresholds);
	}
	
	$scope.helpFind = 
		"<h3>What would would you like to find?</h3>" +
		"<h4>Required</h4>" +
		"<p>Users have the option to return overlapping or exact matches.  <strong>Overlapping matches</strong> are results that overlap " +
		"the queried genes or coordinates, plus any specified padding, by at least 1bp. <strong>Overlapping matches</strong> can be searched using " +
		"gene names or coordinates. <strong>Exact matches</strong> can only be searched using gene names and will only return results " +
		"with a matching gene annotation.</p>";
	
	$scope.helpOrganism = 
		"<h3>What Genome?</h3>" +
		"<h4>Required</h4>" +
		"<p>Only one genome build can be selected per query.  Only genome builds that have searchable data will be displayed " +
		"in the dropdown menu.  The genome build list can also be restricted by the dropdowns in the datasets section or by " +
		"the experiment type.</p> ";
	
	$scope.helpDataset = 
		"<h3>What Datasets?</h3>" +
		"<h4>Required</h4>" +
		"<p>Only one experiment type can be selected per query.  The list of available experiment types can be restricted " +
		"by the optional dropdowns in the datasets section.  Currently, only RNA-Seq data can be searched when <strong>Exact " +
		"Matches</strong> option is specified. All experiment types are available if the <strong>Overlapping Matches</strong> option is selected.</p>" +
		"<h4>Optional</h4>" +
		"<p>The queried datasets can be restricted by the labs, projects, analyses and sample source dropdowns.  Only data " +
		"visible to the user will be displayed and the data displayed reflects previous choices.  In all cases, multiple " +
		"entries can be selected.</p>"+
		"<p>If the <strong>Search Results</strong> checkbox is selected, the previous query's results are searched instead of the entire database. " +
		"Selecting this option will disable all other options in the <strong>What Datasets?</strong> section.</p>";
	
	$scope.helpThresholds = 
		"<h3>Exceed these Thresholds</h3>" +
		"<h4>Optional</h4>" +
		"<p>Results can also be restricted by FDR or Log2 Fold Change. Biominer expects FDR to be untransformed, so lower values are " +
		"more signifant.</p>";
	
	$scope.helpIntersect = 
		"<h3>That Intersect/Don't Intersect</h3>" +
		"<h4>Optional</h4>" +
		"<p>Users can opt to restrict results to a desired set of genes or regions.  These can be typed into the available " +
		"text fields (max 1000 characters) or uploaded from a file (BED files can be uploaded for regions).  Uploaded files " +
		"can be zipped or gzipped. If the <strong>Overlapping Matches</strong> option is selected, users have the option to add padding to " +
		"their searches. If region coordinates are negative or are beyond the of the chromosome boundary before or after padding, the " +
		"query will still run, but a warning message will found in the <strong>Results Panel</strong>. Headers are not expected.</p>" +
		"<p>A region line must have the chromosome, start coordinate and end coordinate in that order. " +
		"It's OK if there is information after the region info, but there can't be any information preceding. " +
		"There can be only one region per line, any more will be skipped.  Regions can be in the format 'chr:start-end' or 'chr\\tstart\\tend', " +
		"where \\t is a tab.</p>" +
		"<p>Genes can be separated by commas or newlines.  Genes names are not checked against a database until the query " +
		"is run.</p>" +
		"<p>Users can also opt to search for results that do not match a set of genes or regions by selecting the <strong>Does not intersect</strong> " +
		"button.</p>" +
	    "<p>Return all results will not intersect results with genes or genomic coordinates.</p>";
	
	$scope.helpQuery = "<h3>Running a Query</h3>" +
		"<p>Queries can be run by clicking on the <strong>Run Query</strong> button found at the top and the botton of the query panel. " +
		"If a required input is missing, the query is terminated and the missing field is flagged.  While the query is " +
		"running, there is a busy animation displayed over the results panel.  Users have the option to stop the query while it's running by " +
		"clicking on the <strong>Stop Query</strong> button.  If the user tries to navigate off the page while the query is running, they will get " +
		"warning message stating that they will lose the query data. Users can clear the results and query panels by clicking on the " +
		"<strong>Clear</strong> button</p>";
	
	$scope.helpPreamble = 
		"<p>This page allows users to search for results in the Biominer database.  Users specify the type of data they " +
		"want to find and can optionally set restrictions on the results they get back. Returned results can be used in new " +
		"queries, viewed in IGV or downloaded as a tab-delimited text file.  Users that log in before searching will" +
		"be able to re-load the last run query.</p>"; 
	
	$scope.helpResults = "" + 
		"<h3>Results Panel</h3>" +
		"<p>When a query completes, the first 25 results are returned to Biominer. The total number of hits are displayed in the <strong>Results Panel</strong> header along with " +
		"any errors or warnings. A text summary of the users query is also displayed just below the <strong>Results Panel</strong> header. Users have the option to increase " +
		"the number of returned hits to a maximum of 100 or use the arrow buttons at the bottom of the panel to page through the results. " +
		"By default, the results are sorted by FDR, but users can sort by coordinate or log2ratio instead.</p>" +
		"<p>If individual result rows are selected or if all results are selected using the checkbox in the header, users can use the <strong>Copy Coordinates</strong> button " +
		"in the <strong>Results Panel</strong> header to copy the selected results coordinates back to the query page. If results are annotated with a gene name, there is " +
		"also a <strong>Copy Genes</strong> button.</p>" +
		"<p>The <strong>Download</strong> button at the top of the <strong>Results Panel</strong> can be used to save the results of a query as a tab-delimited text file." + 
		"All results are saved, not just results visible in the <strong>Results Panel</strong>.</p>" +
		"<p>The <strong>Display in IGV</strong> button at the top of the <strong>Results Panel</strong> can be used to view results in IGV.  See below for more information " +
		"this feature</p>" +
		"<p>If Biominer detects and problems with a query or while creating IGV sessions, a red button will appear at the top of the <strong>Results Panel</strong>. " +
		"Users can click on the button to get a detailed description of the problem.  Typically the messages will list genes that couldn't be " +
		"identified or boundaries that run off the end of the chromosome.  Occassionally, the message will be more dire, for example a missing " +
		"datatrack.</p>" +
		"<h3>Loading Last Result</h3>"  +
		"<p>If the user is not running Biominer as a guest and no results are displayed, the user can load their last query and results by " +
		"clicking on the <strong>Load Last</strong> button.</p>" +
		"<h3>Display in IGV</h3>" +
		"<p>If returned results are associated with datatracks, users can view their data using IGV. When the IGV button is clicked, Biominer tries to " +
		"look for an open IGV application.  If that fails, it will offer to download IGV from amazon.  Please note that Biominer is only compatible with " +
		"IGV 2.3.41 or later.  Once IGV is open, Biominer prepares a session file containing datatracks associated with the results and loads it into " +
		"IGV.  The coordinates listed in the results become hyperlinks and users can click on them to drive IGV.  Once IGV is closed, the hyperlinks return " +
		"to plain text. There is a limit to how much data IGV can handle, so if your results contain a ton of datatracks, the performance will be poor.</p>";
	
	
	$rootScope.helpMessage = 
		
		    "<h1>Query Page</h1>" +
		    $scope.helpPreamble +
		    $scope.helpQuery +
		    $scope.helpFind +
		    $scope.helpOrganism + 
		    $scope.helpDataset + 
		    $scope.helpIntersect + 
		    $scope.helpThresholds +
		    $scope.helpResults;
			
	
}]);